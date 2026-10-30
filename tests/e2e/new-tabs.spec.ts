import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so the panel page runs in a normal tab.

test('the panel scrolls to a tab that opens in the background below the visible rows', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  // Many tabs before the opener, so that the new tab lands below the visible part of the list.
  await serviceWorker.evaluate(async (url) => {
    for (let i = 0; i < 15; i++) await chrome.tabs.create({ url, active: false });
  }, `${site.origin}/blank`);
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 360, height: 240 });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const links = await context.newPage();
  await links.route('**/links', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>links</title><a href="/other">open</a>',
    }),
  );
  await links.goto(`${site.origin}/links`);
  const linksRow = panel.getByRole('listitem').filter({ hasText: 'links' });
  await expect(linksRow).toHaveCount(1);
  await expect(panel.getByRole('listitem').filter({ hasText: /^blank$/ })).toHaveCount(15);
  // The panel follows the row of a new tab for a second: scroll back until the list rests at the top.
  await expect(async () => {
    await panel.getByRole('main', { name: 'Sidearc' }).evaluate((main) => main.scrollTo(0, 0));
    await expect(linksRow).not.toBeInViewport({ timeout: 1500 });
  }).toPass();

  await links.bringToFront();
  await links.getByRole('link', { name: 'open' }).click({ button: 'middle' });

  const otherRow = panel.getByRole('listitem').filter({ hasText: 'other' });
  await expect(otherRow).toBeVisible();
  await expect(otherRow).toBeInViewport({ ratio: 1 });
});

test('a New Tab page that the user opens becomes the first Unpinned Tab', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const form = await context.newPage();
  await form.goto(`${site.origin}/form`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const tabIds = () =>
    serviceWorker.evaluate(async () =>
      (await chrome.tabs.query({})).sort((a, b) => a.index - b.index).map((tab) => tab.id),
    );
  const before = await tabIds();

  // Playwright's own pages have an opener, so they are not a tab that the user opens. A tab without an
  // address and without an opener is what Chrome makes for Ctrl+T and for the "+" button.
  await serviceWorker.evaluate(() => chrome.tabs.create({}));

  await expect.poll(async () => (await tabIds())[0]).not.toBe(before[0]);
  const after = await tabIds();
  expect(after.slice(1)).toEqual(before);
  const titles = await panel
    .getByRole('main', { name: 'Sidearc' })
    .getByRole('listitem')
    .allTextContents();
  expect(titles[0]).toMatch(/new tab/i);
});
