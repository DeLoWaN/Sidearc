import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so the panel page runs in a normal tab.

test('Auto Archive closes a tab that nobody views, and View Archive reopens it', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const old = await context.newPage();
  await old.goto(`${site.origin}/other`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const oldRow = panel.getByRole('button', { name: 'other', exact: true });
  await expect(oldRow).toBeVisible();

  // The worker clock runs two hours ahead and a one-shot alarm stands in for the 5 minute alarm.
  // So the tab, last visited just now, is older than the 1 hour delay.
  await serviceWorker.evaluate(async () => {
    const realNow = Date.now;
    Date.now = () => realNow() + 2 * 3600 * 1000;
    await chrome.storage.local.set({ settings: { autoArchiveHours: 1 } });
    await chrome.alarms.create('auto-archive', { delayInMinutes: 0.05 });
  });
  await expect(oldRow).toBeHidden({ timeout: 15_000 });
  const tabsOnOldUrl = () =>
    serviceWorker.evaluate(
      async (url) => (await chrome.tabs.query({ url })).length,
      `${site.origin}/other`,
    );
  expect(await tabsOnOldUrl()).toBe(0);

  await panel.getByRole('button', { name: 'View Archive' }).click();
  const view = panel.getByRole('dialog', { name: 'View Archive' });
  await expect(view.getByRole('button', { name: /other/ })).toBeVisible();

  await view.getByRole('button', { name: /other/ }).click();
  await expect.poll(tabsOnOldUrl).toBe(1);
  await expect(view).toBeHidden();
  await expect(oldRow).toBeVisible();
  await panel.getByRole('button', { name: 'View Archive' }).click();
  await expect(view).toContainText('No archived tabs');
});

test('Clear closes every Unpinned Tab and archives them', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const form = await context.newPage();
  await form.goto(`${site.origin}/form`);
  const other = await context.newPage();
  await other.goto(`${site.origin}/other`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.getByRole('button', { name: 'form', exact: true })).toBeVisible();

  await panel.getByRole('button', { name: 'Clear' }).click();

  await expect
    .poll(() =>
      serviceWorker.evaluate(async () => {
        const { archive } = await chrome.storage.local.get('archive');
        return (archive as { url: string }[] | undefined)?.map((entry) => entry.url).sort();
      }),
    )
    .toEqual([`${site.origin}/form`, `${site.origin}/other`]);
  const urls = await serviceWorker.evaluate(async () =>
    (await chrome.tabs.query({})).map((tab) => tab.url),
  );
  expect(urls).not.toContain(`${site.origin}/form`);
  expect(urls).not.toContain(`${site.origin}/other`);
  // The window keeps one tab, so the browser stays open.
  expect(urls.length).toBeGreaterThan(0);
});
