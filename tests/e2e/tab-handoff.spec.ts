import { expect, test } from './fixtures';

const marksOf = () => ({
  marker: (window as unknown as { __marker: number }).__marker,
  timeOrigin: performance.timeOrigin,
  navigationEntries: performance.getEntriesByType('navigation').length,
  value: (document.getElementById('field') as HTMLInputElement).value,
});

test('a click in the panel brings a tab of another window here with its page state', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const formUrl = `${site.origin}/form`;
  const page = await context.newPage();
  await page.goto(formUrl);
  await page.locator('#field').fill('half-filled text');
  const before = await page.evaluate(marksOf);

  // The panel page lives in a second window, so the form tab is in another window.
  const panelOpened = context.waitForEvent('page');
  const panelWindowId = await serviceWorker.evaluate(async (url) => {
    const created = await chrome.windows.create({ url });
    return created?.id as number;
  }, `chrome-extension://${extensionId}/sidepanel.html`);
  const panel = await panelOpened;
  const tab = () =>
    serviceWorker.evaluate(async (url) => {
      const [found] = await chrome.tabs.query({ url });
      return { windowId: found?.windowId, active: found?.active };
    }, formUrl);
  expect((await tab()).windowId).not.toBe(panelWindowId);

  await panel.getByRole('button', { name: 'form', exact: true }).click();

  await expect.poll(tab).toEqual({ windowId: panelWindowId, active: true });
  expect(
    await serviceWorker.evaluate(async (url) => (await chrome.tabs.query({ url })).length, formUrl),
  ).toBe(1);
  const after = await page.evaluate(marksOf);
  expect(after.value).toBe('half-filled text');
  // A reload would change the script marker, the document start time and the navigation count.
  expect(after).toEqual(before);
});
