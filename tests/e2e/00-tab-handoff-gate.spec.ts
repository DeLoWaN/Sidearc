import { expect, test } from './fixtures';

// The name starts with 00 so this gate runs before every other end-to-end test.
test('a tab moved to another window keeps its typed text and does not reload', async ({
  context,
  serviceWorker,
  site,
}) => {
  const page = await context.newPage();
  await page.goto(`${site.origin}/form`);
  await page.locator('#field').fill('half-filled text');

  const before = await page.evaluate(() => ({
    marker: (window as unknown as { __marker: number }).__marker,
    timeOrigin: performance.timeOrigin,
    navigationEntries: performance.getEntriesByType('navigation').length,
  }));

  const { tabId, fromWindowId } = await serviceWorker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    return { tabId: tab?.id as number, fromWindowId: tab?.windowId as number };
  }, `${site.origin}/form`);
  const toWindowId = await serviceWorker.evaluate(async () => {
    const created = await chrome.windows.create({ url: 'about:blank' });
    return created?.id as number;
  });
  expect(toWindowId).not.toBe(fromWindowId);

  const moved = await serviceWorker.evaluate(
    async ([id, windowId]) =>
      chrome.tabs.move(id as number, { windowId: windowId as number, index: -1 }),
    [tabId, toWindowId],
  );
  expect(Array.isArray(moved) ? moved[0]?.windowId : moved.windowId).toBe(toWindowId);
  await serviceWorker.evaluate((id) => chrome.tabs.update(id, { active: true }), tabId);

  const after = await page.evaluate(() => ({
    marker: (window as unknown as { __marker: number }).__marker,
    timeOrigin: performance.timeOrigin,
    navigationEntries: performance.getEntriesByType('navigation').length,
    value: (document.getElementById('field') as HTMLInputElement).value,
  }));
  expect(after.value).toBe('half-filled text');
  // A reload would change the script marker, the document start time and the navigation count.
  expect(after.marker).toBe(before.marker);
  expect(after.timeOrigin).toBe(before.timeOrigin);
  expect(after.navigationEntries).toBe(before.navigationEntries);
  const windowNow = await serviceWorker.evaluate(
    async (id) => (await chrome.tabs.get(id)).windowId,
    tabId,
  );
  expect(windowNow).toBe(toWindowId);
});
