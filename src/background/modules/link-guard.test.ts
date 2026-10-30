import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';
import type { LinkGuardPush } from '../../shared/protocol';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0] as chrome.tabs.Tab;
const idOf = async (url: string) => (await tabOf(url)).id as number;

const isLive = (tabId: number) =>
  fakeChrome.messageFromTab(tabId, { rpc: 'link-guard/is-live', request: null });
const open = (tabId: number, url: string) =>
  fakeChrome.messageFromTab(tabId, { rpc: 'link-guard/open', request: { url } });

/** The last live status that the worker pushed to the tab, or undefined when it pushed none. */
function lastPush(tabId: number) {
  const pushes = fakeChrome.tabMessages
    .filter((sent) => sent.tabId === tabId)
    .map((sent) => sent.message as LinkGuardPush);
  return pushes.at(-1)?.live;
}

/** Presses the "pin current tab" shortcut while this tab is the current one. */
async function pin(url: string) {
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', await tabOf(url));
  await settle();
}

it('tells a tab whether it is the live tab of an item', async () => {
  await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  await pin('https://a.test/');

  expect(await isLive(await idOf('https://a.test/'))).toBe(true);
  expect(await isLive(await idOf('https://b.test/'))).toBe(false);
});

it('tells a tab that it became live after it loaded', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  const tabId = await idOf('https://a.test/');
  expect(await isLive(tabId)).toBe(false);

  await pin('https://a.test/');

  expect(lastPush(tabId)).toBe(true);
  expect(fakeChrome.tabMessages.at(-1)).toMatchObject({ frameId: 0 });
});

it('tells a tab that it stopped being live when its item is deleted', async () => {
  const windowId = await fakeChrome.openWindow(['https://a.test/']);
  const panel = connectPanel(windowId);
  await pin('https://a.test/');
  const tabId = await idOf('https://a.test/');
  expect(lastPush(tabId)).toBe(true);

  panel.send({ type: 'item/delete', itemId: panel.latest()?.items[0]?.id as string });
  await settle();

  expect(lastPush(tabId)).toBe(false);
  expect(await isLive(tabId)).toBe(false);
});

it('tells the live tab only, never a tab that is not a web page', async () => {
  await fakeChrome.openWindow(['https://a.test/', 'chrome://newtab/']);
  await pin('https://a.test/');

  const receivers = new Set(fakeChrome.tabMessages.map((sent) => sent.tabId));
  expect([...receivers]).toEqual([await idOf('https://a.test/')]);
});

it('opens a link in a new Unpinned Tab next to the live tab, and the live tab stays', async () => {
  const windowId = await fakeChrome.openWindow(['https://a.test/', 'https://c.test/']);
  const panel = connectPanel(windowId);
  await pin('https://a.test/');
  const liveId = await idOf('https://a.test/');

  await open(liveId, 'https://other.test/page');
  await settle();

  const tabs = await browser.tabs.query({ windowId });
  expect(tabs.map((tab) => tab.url)).toEqual([
    'https://a.test/',
    'https://other.test/page',
    'https://c.test/',
  ]);
  expect(tabs[1]?.active).toBe(true);
  expect(panel.latest()?.unpinnedTabs.map((tab) => tab.url)).toEqual([
    'https://other.test/page',
    'https://c.test/',
  ]);
  expect(panel.latest()?.items[0]?.live?.tabId).toBe(liveId);
  expect(await isLive(await idOf('https://other.test/page'))).toBe(false);
});

it.each([
  'javascript:alert(1)',
  'mailto:someone@other.test',
  'file:///tmp/a.html',
  'chrome://settings/',
  'not an address',
])('does not open %s', async (url) => {
  const windowId = await fakeChrome.openWindow(['https://a.test/']);

  await open(await idOf('https://a.test/'), url);
  await settle();

  expect((await browser.tabs.query({ windowId })).map((tab) => tab.url)).toEqual([
    'https://a.test/',
  ]);
});
