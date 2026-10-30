import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0] as chrome.tabs.Tab;
const urlsOf = async (windowId: number) =>
  (await browser.tabs.query({ windowId })).map((tab) => tab.url);

/** Opens windows, connects a panel in the first one and returns helpers to read what it shows. */
async function connectedPanel(urls: string[][]) {
  const windows: number[] = [];
  for (const group of urls) windows.push(await fakeChrome.openWindow(group));
  const panel = connectPanel(windows[0] as number);
  await settle();
  return {
    windows,
    panel,
    items: () => panel.latest()?.items ?? [],
    unpinned: () => panel.latest()?.unpinnedTabs.map((tab) => tab.url),
  };
}

/** Presses the "pin current tab" shortcut while this tab is the current one. */
async function pin(tab: chrome.tabs.Tab) {
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', tab);
  await settle();
}

it('pins the current tab at the root, with the tab as its live tab', async () => {
  const { items, unpinned } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  const tab = await tabOf('https://a.test/');
  await fakeChrome.patchTab(tab.id as number, { title: 'Site A' });

  await pin(await tabOf('https://a.test/'));

  expect(items()).toHaveLength(1);
  expect(items()[0]).toMatchObject({
    kind: 'pinned',
    title: 'Site A',
    url: 'https://a.test/',
    parentId: null,
    live: { tabId: tab.id, away: false },
  });
  expect(items()[0]?.id).toEqual(expect.any(String));
  expect(unpinned()).toEqual(['https://b.test/']);
});
