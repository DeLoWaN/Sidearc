import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { settle, startWorker, stopWorker } from '../../../tests/support/worker';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabIn = async (windowId: number) => (await browser.tabs.query({ windowId }))[0]?.id as number;
const enter = (tabId: number) =>
  fakeChrome.messageFromTab(tabId, { rpc: 'fullscreen/enter', request: null });
const exit = (tabId: number) =>
  fakeChrome.messageFromTab(tabId, { rpc: 'fullscreen/exit', request: null });

/** Opens the side panel of the window, as a click on the Sidesweep icon does. */
async function openPanel(windowId: number) {
  await browser.sidePanel.open({ windowId });
  await settle();
}

it('closes the open side panel of the window when a tab enters fullscreen', async () => {
  const windowId = await fakeChrome.openWindow(['https://www.youtube.com/watch?v=1']);
  await openPanel(windowId);

  expect(await enter(await tabIn(windowId))).toBe(true);

  expect(fakeChrome.sidePanelClosed).toEqual([windowId]);
});

it('leaves a closed side panel alone when a tab enters fullscreen', async () => {
  const windowId = await fakeChrome.openWindow(['https://www.youtube.com/watch?v=1']);

  expect(await enter(await tabIn(windowId))).toBe(false);

  expect(fakeChrome.sidePanelClosed).toEqual([]);
});

it('leaves the side panel of another window open', async () => {
  const video = await fakeChrome.openWindow(['https://www.youtube.com/watch?v=1']);
  const other = await fakeChrome.openWindow(['https://a.test/']);
  await openPanel(other);

  expect(await enter(await tabIn(video))).toBe(false);

  expect(fakeChrome.sidePanelClosed).toEqual([]);
});

it('forgets a side panel that the user closed', async () => {
  const windowId = await fakeChrome.openWindow(['https://www.youtube.com/watch?v=1']);
  await openPanel(windowId);
  await browser.sidePanel.close({ windowId });
  await settle();

  expect(await enter(await tabIn(windowId))).toBe(false);
});

it('remembers the open side panel after the worker stops', async () => {
  const windowId = await fakeChrome.openWindow(['https://www.youtube.com/watch?v=1']);
  await openPanel(windowId);
  stopWorker();
  await startWorker();

  expect(await enter(await tabIn(windowId))).toBe(true);
});

it('opens the side panel again when the tab leaves fullscreen', async () => {
  const windowId = await fakeChrome.openWindow(['https://www.youtube.com/watch?v=1']);
  await openPanel(windowId);
  const tabId = await tabIn(windowId);
  await enter(tabId);
  fakeChrome.sidePanelOpened = [];

  expect(await exit(tabId)).toBe(true);

  expect(fakeChrome.sidePanelOpened).toEqual([windowId]);
  // The panel counts as open again, so the next fullscreen closes it too.
  await settle();
  expect(await enter(tabId)).toBe(true);
});

it('answers false when Chrome refuses to open the side panel without a user gesture', async () => {
  const windowId = await fakeChrome.openWindow(['https://www.youtube.com/watch?v=1']);
  await openPanel(windowId);
  const tabId = await tabIn(windowId);
  await enter(tabId);
  vi.spyOn(browser.sidePanel, 'open').mockRejectedValue(
    new Error('`sidePanel.open()` may only be called in response to a user gesture.'),
  );

  expect(await exit(tabId)).toBe(false);
});
