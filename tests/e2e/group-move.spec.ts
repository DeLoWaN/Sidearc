import type { BrowserContext, Page, Worker } from '@playwright/test';
import { dragTo, drop, openPanel, rowOf, saved, saveItems, strip } from './dnd-support';
import { expect, test } from './fixtures';

// Drags and menu moves of a whole group, on the real extension in a normal tab.

/** Serves `/page/<name>` as a page that has the title `<name>`. */
async function servePages(context: BrowserContext) {
  await context.route('**/page/*', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>${name}</title><p>${name}</p>`,
    });
  });
}

/**
 * Keeps the tabs of the test where Chrome opens them: no site group forms, and a new tab does not jump to the start.
 * Tabs that Playwright opens have an opener, and they share one host.
 */
const keepTabsApart = (serviceWorker: Worker, groupBySite = false) =>
  serviceWorker.evaluate(
    (group) => chrome.storage.local.set({ settings: { groupBySite: group, newTabsOnTop: false } }),
    groupBySite,
  );

/** Opens one tab for each name, in order, none of them from another tab. */
async function openPages(context: BrowserContext, origin: string, names: string[]) {
  for (const name of names) {
    const page = await context.newPage();
    await page.goto(`${origin}/page/${name}`);
  }
}

/** The top-level entries of the Unpinned Tabs in the panel: `[Name]` for a group block, the title for a tab. */
const panelOrder = (panel: Page, names: string[]) =>
  panel
    .getByRole('region', { name: 'Unpinned Tabs' })
    .locator(':scope > ul > li')
    .evaluateAll(
      (items, wanted) =>
        items
          .map((item) => {
            const block = item.querySelector('[role="group"]');
            return block ? `[${block.getAttribute('aria-label')}]` : (item.textContent ?? '');
          })
          .filter((text) => text.startsWith('[') || wanted.includes(text)),
      names,
    );

const groupTabs = (serviceWorker: Worker, titles: string[], title: string) =>
  serviceWorker.evaluate(
    async ([wanted, name]) => {
      const tabs = await chrome.tabs.query({});
      const ids = wanted.map(
        (tabTitle) => tabs.find((tab) => tab.title === tabTitle)?.id as number,
      ) as [number, ...number[]];
      const id = (await chrome.tabs.group({ tabIds: ids })) as number;
      await chrome.tabGroups.update(id, { title: name, color: 'blue' });
      return id;
    },
    [titles, title] as const,
  );

const ALL = ['alpha', 'beta', 'gamma', 'delta'];
const tabRow = (panel: Page, name: string) =>
  rowOf(panel.getByRole('region', { name: 'Unpinned Tabs' }), name);

test('a Tab group is dragged by its header below a tab, in the panel and in the Chrome tab strip', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await servePages(context);
  await keepTabsApart(serviceWorker);
  await openPages(context, site.origin, ALL);
  await groupTabs(serviceWorker, ['alpha', 'beta'], 'Work');
  const panel = await openPanel(context, extensionId);
  const block = panel.getByRole('group', { name: 'Work' });
  await expect(block).toBeVisible();
  await expect
    .poll(() => strip(serviceWorker, ALL))
    .toEqual(['alpha@group', 'beta@group', 'gamma', 'delta']);

  await dragTo(
    panel,
    block.getByRole('button', { name: 'Work', exact: true }),
    tabRow(panel, 'gamma'),
    0.5,
    0.85,
  );
  await expect(tabRow(panel, 'gamma')).toHaveAttribute('data-drop', 'below');
  await drop(panel);

  await expect
    .poll(() => strip(serviceWorker, ALL))
    .toEqual(['gamma', 'alpha@group', 'beta@group', 'delta']);
  await expect.poll(() => panelOrder(panel, ALL)).toEqual(['gamma', '[Work]', 'delta']);
});

test('a Tab group dropped above the last tab goes up and keeps its tabs in the group', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await servePages(context);
  await keepTabsApart(serviceWorker);
  await openPages(context, site.origin, ALL);
  await groupTabs(serviceWorker, ['gamma', 'delta'], 'Late');
  const panel = await openPanel(context, extensionId);
  const block = panel.getByRole('group', { name: 'Late' });
  await expect(block).toBeVisible();

  await dragTo(
    panel,
    block.getByRole('button', { name: 'Late', exact: true }),
    tabRow(panel, 'alpha'),
    0.5,
    0.15,
  );
  await expect(tabRow(panel, 'alpha')).toHaveAttribute('data-drop', 'above');
  await drop(panel);

  await expect
    .poll(() => strip(serviceWorker, ALL))
    .toEqual(['gamma@group', 'delta@group', 'alpha', 'beta']);
});

test('a site group is dragged by its header below a tab, and its members stay together in the strip', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await servePages(context);
  await keepTabsApart(serviceWorker);
  await openPages(context, site.origin, ['alpha', 'beta']);
  const links = await context.newPage();
  await links.route('**/links', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>links</title><a href="/other">same site</a>',
    }),
  );
  await links.goto(`${site.origin}/links`);
  const panel = await openPanel(context, extensionId);
  const blocks = panel.locator('[data-site-group]');
  const host = new URL(site.origin).host;
  // Only the tab that the click opens may join a group.
  await keepTabsApart(serviceWorker, true);
  await links.bringToFront();
  await links.getByRole('link', { name: 'same site' }).click({ button: 'middle' });
  await expect(blocks).toHaveCount(1);
  const names = ['alpha', 'beta', 'links', 'other'];
  await expect.poll(() => strip(serviceWorker, names)).toEqual(['alpha', 'beta', 'links', 'other']);

  await dragTo(
    panel,
    blocks.getByRole('button', { name: host, exact: true }),
    tabRow(panel, 'alpha'),
    0.5,
    0.85,
  );
  await expect(tabRow(panel, 'alpha')).toHaveAttribute('data-drop', 'below');
  await drop(panel);

  await expect.poll(() => strip(serviceWorker, names)).toEqual(['alpha', 'links', 'other', 'beta']);
  await expect.poll(() => panelOrder(panel, names)).toEqual(['alpha', `[${host}]`, 'beta']);
  await expect(blocks.getByRole('listitem')).toHaveText(['links', 'other']);
});

test('a group dropped on its own block or on a Pinned Tab changes nothing, and a drop on a member of another group lands next to that block', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await servePages(context);
  await keepTabsApart(serviceWorker);
  await openPages(context, site.origin, ALL);
  await groupTabs(serviceWorker, ['alpha', 'beta'], 'Work');
  await groupTabs(serviceWorker, ['gamma'], 'Other');
  await saveItems(serviceWorker, [saved('mail', 'pinned', 'Mail', 0)]);
  const panel = await openPanel(context, extensionId);
  const work = panel.getByRole('group', { name: 'Work' });
  await expect(work).toBeVisible();
  const before = await strip(serviceWorker, ALL);

  // On its own block: no indicator.
  await dragTo(
    panel,
    work.getByRole('button', { name: 'Work', exact: true }),
    work.getByRole('listitem').last(),
    0.5,
    0.5,
  );
  await panel.waitForTimeout(200);
  await expect(panel.locator('[data-drop]')).toHaveCount(0);
  await drop(panel);
  await panel.waitForTimeout(300);
  expect(await strip(serviceWorker, ALL)).toEqual(before);

  // On a Pinned Tab: no indicator.
  const pinned = rowOf(panel.getByRole('list', { name: 'Pinned Tabs list' }), 'Mail');
  await dragTo(panel, work.getByRole('button', { name: 'Work', exact: true }), pinned, 0.5, 0.5);
  await panel.waitForTimeout(200);
  await expect(panel.locator('[data-drop]')).toHaveCount(0);
  await drop(panel);
  await panel.waitForTimeout(300);
  expect(await strip(serviceWorker, ALL)).toEqual(before);
  await expect(panel.getByRole('group', { name: 'Work' })).toBeVisible();

  // On a member of another group: the indicator is on the block, never inside it.
  const other = panel.getByRole('group', { name: 'Other' });
  await dragTo(
    panel,
    work.getByRole('button', { name: 'Work', exact: true }),
    other.getByRole('listitem').first(),
    0.5,
    0.9,
  );
  await expect(other).toHaveAttribute('data-drop', 'below');
  await expect(other.getByRole('listitem').first()).not.toHaveAttribute('data-drop', /.+/);
  await drop(panel);

  await expect
    .poll(() => strip(serviceWorker, ALL))
    .toEqual(['gamma@group', 'alpha@group', 'beta@group', 'delta']);
});

test('"Move group down" and "Move group up" in the header menu move a Tab group by one entry', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await servePages(context);
  await keepTabsApart(serviceWorker);
  await openPages(context, site.origin, ALL);
  await groupTabs(serviceWorker, ['beta', 'gamma'], 'Work');
  const panel = await openPanel(context, extensionId);
  const header = panel
    .getByRole('group', { name: 'Work' })
    .getByRole('button', { name: 'Work', exact: true });
  await expect(header).toBeVisible();

  await header.click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Move group down' }).click();
  await expect
    .poll(() => strip(serviceWorker, ALL))
    .toEqual(['alpha', 'delta', 'beta@group', 'gamma@group']);

  await header.click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Move group up' }).click();
  await expect
    .poll(() => strip(serviceWorker, ALL))
    .toEqual(['alpha', 'beta@group', 'gamma@group', 'delta']);
});
