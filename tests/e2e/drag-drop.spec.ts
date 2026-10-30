import type { Locator, Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';

// Pragmatic drag and drop uses native drag events. Playwright turns real mouse moves into them.
// Playwright cannot drive the real side panel, so the panel page runs in a normal tab.

interface SavedItem {
  id: string;
  kind: 'pinned' | 'folder' | 'favorite';
  title: string;
  url: string;
  parentId: string | null;
  position: number;
  collapsed: boolean;
}

const saved = (
  id: string,
  kind: SavedItem['kind'],
  title: string,
  position: number,
  parentId: string | null = null,
  url = kind === 'folder' ? '' : `http://saved.test/${id}`,
): SavedItem => ({ id, kind, title, url, parentId, position, collapsed: false });

const saveItems = (serviceWorker: Worker, items: SavedItem[]) =>
  serviceWorker.evaluate((list) => chrome.storage.local.set({ items: list }), items);

/** The saved items by id, from the storage of the worker. */
const storedItems = (serviceWorker: Worker) =>
  serviceWorker.evaluate(async () => {
    const { items } = await chrome.storage.local.get('items');
    return (items ?? []) as SavedItem[];
  });

/** The ids inside one parent in position order, for the Pinned Tabs and Folders or the Favorites. */
async function order(serviceWorker: Worker, parentId: string | null, favorites = false) {
  return (await storedItems(serviceWorker))
    .filter((item) => item.parentId === parentId && (item.kind === 'favorite') === favorites)
    .sort((a, b) => a.position - b.position)
    .map((item) => item.id);
}

/** The tabs of the first window in strip order, as `title@group` when a Tab group holds the tab. */
const strip = (serviceWorker: Worker, titles: string[]) =>
  serviceWorker.evaluate(async (wanted) => {
    const tabs = (await chrome.tabs.query({})).sort((a, b) => a.index - b.index);
    return tabs
      .filter((tab) => wanted.includes(tab.title ?? ''))
      .map((tab) => `${tab.title}${tab.groupId === -1 ? '' : '@group'}`);
  }, titles);

/** The row of a section or list that holds the button with this name. */
const rowOf = (scope: Locator, name: string) =>
  scope
    .getByRole('listitem')
    .filter({ has: scope.page().getByRole('button', { name, exact: true }) })
    .last();

/** Presses on the source, drags to a point of the target (as fractions of its box), and holds. */
async function dragTo(page: Page, source: Locator, target: Locator, fx: number, fy: number) {
  const from = await source.boundingBox();
  if (!from) throw new Error('Source is not on screen');
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 4, startY + 6, { steps: 3 });
  // The panel can add a drop place when a drag starts: measure the target after that.
  await page.waitForTimeout(200);
  const to = await target.boundingBox();
  if (!to) throw new Error('Target is not on screen');
  await page.mouse.move(to.x + to.width * fx, to.y + to.height * fy, { steps: 12 });
  await page.mouse.move(to.x + to.width * fx, to.y + to.height * fy);
}

const drop = (page: Page) => page.mouse.up();

async function openPanel(context: import('@playwright/test').BrowserContext, extensionId: string) {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  return panel;
}

async function openTabs(context: import('@playwright/test').BrowserContext, urls: string[]) {
  for (const url of urls) {
    const page = await context.newPage();
    await page.goto(url);
  }
}

const hasLiveTab = (serviceWorker: Worker, itemId: string) =>
  serviceWorker.evaluate(async (id) => {
    const links = (await chrome.storage.session.get('liveTabs')).liveTabs ?? {};
    return id in links;
  }, itemId);

test('an Unpinned Tab dropped inside a Folder becomes a Pinned Tab and the tab becomes its live tab', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await saveItems(serviceWorker, [saved('work', 'folder', 'Work', 0)]);
  await openTabs(context, [`${site.origin}/form`]);
  const panel = await openPanel(context, extensionId);
  const work = rowOf(panel.getByRole('list', { name: 'Pinned Tabs list' }), 'Work');
  const tab = rowOf(panel.getByRole('region', { name: 'Unpinned Tabs' }), 'form');
  await expect(tab).toBeVisible();

  await dragTo(panel, tab.getByRole('button', { name: 'form', exact: true }), work, 0.5, 0.5);
  await expect(work).toHaveAttribute('data-drop', 'inside');
  await drop(panel);

  const inWork = panel.getByRole('list', { name: 'Work content' });
  await expect(inWork.getByRole('button', { name: 'form', exact: true })).toBeVisible();
  await expect(panel.getByRole('region', { name: 'Unpinned Tabs' })).not.toContainText('form');
  const [created] = (await storedItems(serviceWorker)).filter((item) => item.title === 'form');
  expect(created).toMatchObject({ kind: 'pinned', parentId: 'work', url: `${site.origin}/form` });
  await expect.poll(() => hasLiveTab(serviceWorker, created?.id as string)).toBe(true);
  await expect(panel.getByRole('button', { name: 'Close form' })).toBeAttached();
});
