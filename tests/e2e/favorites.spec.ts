import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';

// The worker keeps its items in storage: the tests save them there and read the real panel page.

const record = (id: string, kind: string, title: string, url: string, position: number) => ({
  id,
  kind,
  title,
  url,
  parentId: null,
  position,
  collapsed: false,
});

const saveItems = (serviceWorker: Worker, items: ReturnType<typeof record>[]) =>
  serviceWorker.evaluate((saved) => chrome.storage.local.set({ items: saved }), items);

const tabsOn = (serviceWorker: Worker, url: string) =>
  serviceWorker.evaluate(async (target) => (await chrome.tabs.query({ url: target })).length, url);

async function moveTo(panel: Page, row: ReturnType<Page['getByRole']>, target: string) {
  await row.click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Move to…' }).click();
  await panel.getByRole('menuitem', { name: target, exact: true }).click();
}

test('a Favorite opens one live tab, shows a mark, and moves to the Pinned Tabs and back with its tab', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const docsUrl = `${site.origin}/other`;
  const mailUrl = `${site.origin}/blank`;
  await saveItems(serviceWorker, [
    record('fav-docs', 'favorite', 'Docs', docsUrl, 0),
    record('pinned-mail', 'pinned', 'Mail', mailUrl, 0),
  ]);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const favorites = panel.getByRole('list', { name: 'Favorites list' });
  const docs = favorites.getByRole('button', { name: 'Docs', exact: true });
  await expect(docs).toBeVisible();
  await expect(panel.getByRole('list', { name: 'Pinned Tabs list' })).not.toContainText('Docs');
  await expect(favorites.getByRole('img', { name: 'Open' })).toBeHidden();

  // A click opens the live tab. A second click shows it and makes no second tab.
  await docs.click();
  await expect(favorites.getByRole('img', { name: 'Open' })).toBeVisible();
  await expect.poll(() => tabsOn(serviceWorker, docsUrl)).toBe(1);
  await docs.click();
  await expect.poll(() => tabsOn(serviceWorker, docsUrl)).toBe(1);

  // A Pinned Tab with an open live tab becomes a Favorite and keeps the tab.
  await panel.getByRole('button', { name: 'Mail', exact: true }).click();
  await expect.poll(() => tabsOn(serviceWorker, mailUrl)).toBe(1);
  await moveTo(panel, panel.getByRole('button', { name: 'Mail', exact: true }), 'Favorites');
  const mail = favorites.getByRole('button', { name: 'Mail', exact: true });
  await expect(mail).toBeVisible();
  await expect(favorites.getByRole('img', { name: 'Open' })).toHaveCount(2);
  await expect(panel.getByRole('list', { name: 'Pinned Tabs list' })).not.toContainText('Mail');
  await expect.poll(() => tabsOn(serviceWorker, mailUrl)).toBe(1);

  // The reverse move keeps the tab too.
  await moveTo(panel, mail, 'Pinned Tabs');
  await expect(
    panel
      .getByRole('list', { name: 'Pinned Tabs list' })
      .getByRole('button', { name: 'Mail', exact: true }),
  ).toBeVisible();
  await expect(favorites.getByRole('button', { name: 'Mail', exact: true })).toBeHidden();
  await expect(panel.getByRole('button', { name: 'Close Mail' })).toBeAttached();
  await expect.poll(() => tabsOn(serviceWorker, mailUrl)).toBe(1);

  // Closing the live tab of a Favorite puts it back to rest.
  await favorites.getByRole('button', { name: 'Close Docs' }).click({ force: true });
  await expect.poll(() => tabsOn(serviceWorker, docsUrl)).toBe(0);
  await expect(favorites.getByRole('img', { name: 'Open' })).toBeHidden();
  await expect(docs).toBeVisible();
});

test('the panel refuses a 13th Favorite with a short message', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const favorites = Array.from({ length: 12 }, (_, n) =>
    record(`fav-${n}`, 'favorite', `Fav ${n}`, `${site.origin}/other?n=${n}`, n),
  );
  await saveItems(serviceWorker, [
    ...favorites,
    record('pinned-mail', 'pinned', 'Mail', `${site.origin}/blank`, 0),
  ]);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const list = panel.getByRole('list', { name: 'Favorites list' });
  await expect(list.getByRole('listitem')).toHaveCount(12);

  await moveTo(panel, panel.getByRole('button', { name: 'Mail', exact: true }), 'Favorites');

  await expect(panel.getByRole('status')).toHaveText(/12 Favorites at most/);
  await expect(list.getByRole('listitem')).toHaveCount(12);
  await expect(
    panel
      .getByRole('list', { name: 'Pinned Tabs list' })
      .getByRole('button', { name: 'Mail', exact: true }),
  ).toBeVisible();
});
