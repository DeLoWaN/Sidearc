import { expect, test } from './fixtures';

// Playwright cannot press an extension shortcut, so the test saves the item in storage
// and checks the rest of the life of a Pinned Tab in real Chromium.

test('a Pinned Tab opens one live tab, shows a navigation away, resets and goes back to rest', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const savedUrl = `${site.origin}/other`;
  await serviceWorker.evaluate(async (url) => {
    await chrome.storage.local.set({
      items: [
        {
          id: 'pinned-1',
          kind: 'pinned',
          title: 'Saved',
          url,
          parentId: null,
          position: 0,
          collapsed: false,
        },
      ],
    });
  }, savedUrl);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const tabsOnSavedUrl = () =>
    serviceWorker.evaluate(async (url) => (await chrome.tabs.query({ url })).length, savedUrl);

  const row = panel.getByRole('button', { name: 'Saved', exact: true });
  await expect(row).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Close Saved' })).toBeHidden();

  // A click opens the live tab. A second click shows it and makes no second tab.
  await row.click();
  await expect(panel.getByRole('button', { name: 'Close Saved' })).toBeAttached();
  await expect.poll(tabsOnSavedUrl).toBe(1);
  await row.click();
  await expect.poll(tabsOnSavedUrl).toBe(1);
  // The live tab is not among the Unpinned Tabs.
  await expect(panel.getByRole('button', { name: 'other', exact: true })).toBeHidden();

  // The live tab leaves the saved URL: the row shows both titles and Reset.
  await serviceWorker.evaluate(
    async ([url, target]) => {
      const [tab] = await chrome.tabs.query({ url });
      await chrome.tabs.update(tab?.id as number, { url: target });
    },
    [savedUrl, `${site.origin}/blank`] as const,
  );
  await expect(panel.getByRole('button', { name: /^Saved\s*\/\s*blank$/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Reset Saved' }).click();
  await expect.poll(tabsOnSavedUrl).toBe(1);
  await expect(panel.getByRole('button', { name: 'Reset Saved' })).toBeHidden();

  // Closing the live tab puts the Pinned Tab back to rest. It stays in the list.
  await panel.getByRole('button', { name: 'Close Saved' }).click({ force: true });
  await expect.poll(tabsOnSavedUrl).toBe(0);
  await expect(panel.getByRole('button', { name: 'Close Saved' })).toBeHidden();
  await expect(row).toBeVisible();
});
