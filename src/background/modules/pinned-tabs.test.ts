import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0] as chrome.tabs.Tab;
const idOf = async (url: string) => (await tabOf(url)).id as number;
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

/** Pins the tab of this URL, then closes it: the item is left at rest. */
async function pinnedAtRest(url: string) {
  await pin(await tabOf(url));
  await browser.tabs.remove(await idOf(url));
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

it('never pins a tab twice', async () => {
  const { items } = await connectedPanel([['https://a.test/']]);
  const tab = await tabOf('https://a.test/');

  await pin(tab);
  await pin(tab);

  expect(items()).toHaveLength(1);
});

it('pins several tabs in the order of the shortcut', async () => {
  const { items } = await connectedPanel([['https://a.test/', 'https://b.test/']]);

  await pin(await tabOf('https://b.test/'));
  await pin(await tabOf('https://a.test/'));

  expect(items().map((item) => [item.url, item.position])).toEqual([
    ['https://b.test/', 0],
    ['https://a.test/', 1],
  ]);
});

it('opens a Pinned Tab at rest in the window of the panel, as its live tab', async () => {
  const { windows, panel, items, unpinned } = await connectedPanel([
    ['https://a.test/', 'https://b.test/'],
    ['https://c.test/'],
  ]);
  await pinnedAtRest('https://a.test/');
  expect(items()[0]?.live).toBeUndefined();

  panel.send({ type: 'item/open', itemId: items()[0]?.id as string });
  await settle();

  expect(await urlsOf(windows[0] as number)).toEqual(['https://b.test/', 'https://a.test/']);
  expect(items()[0]?.live).toMatchObject({
    tabId: await idOf('https://a.test/'),
    windowId: windows[0],
    active: true,
  });
  expect(unpinned()).toEqual(['https://b.test/', 'https://c.test/']);
});

it('never makes a second tab when the panel asks twice at once', async () => {
  const { panel, items } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await pinnedAtRest('https://a.test/');
  const itemId = items()[0]?.id as string;

  panel.send({ type: 'item/open', itemId });
  panel.send({ type: 'item/open', itemId });
  await settle();

  expect(await browser.tabs.query({ url: 'https://a.test/' })).toHaveLength(1);
});

it('shows the live tab of a Pinned Tab that is open, without a second tab', async () => {
  const { windows, panel, items } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await pin(await tabOf('https://a.test/'));
  expect((await browser.tabs.query({ active: true }))[0]?.url).toBe('https://b.test/');

  panel.send({ type: 'item/open', itemId: items()[0]?.id as string });
  await settle();

  expect((await browser.tabs.query({ active: true }))[0]?.url).toBe('https://a.test/');
  expect(await urlsOf(windows[0] as number)).toEqual(['https://a.test/', 'https://b.test/']);
});

it('moves the live tab of another window into the window of the panel and keeps the link', async () => {
  const { windows, panel, items } = await connectedPanel([
    ['https://a.test/'],
    ['https://b.test/', 'https://c.test/'],
  ]);
  await pin(await tabOf('https://b.test/'));
  const liveTabId = await idOf('https://b.test/');
  const [first, second] = windows as [number, number];
  await fakeChrome.focusWindow(first);

  panel.send({ type: 'item/open', itemId: items()[0]?.id as string });
  await settle();

  expect(await urlsOf(first)).toEqual(['https://a.test/', 'https://b.test/']);
  expect(await urlsOf(second)).toEqual(['https://c.test/']);
  const [active] = await browser.tabs.query({ windowId: first, active: true });
  expect(active?.id).toBe(liveTabId);
  expect(await browser.tabs.query({ url: 'https://b.test/' })).toHaveLength(1);
  expect(items()[0]?.live).toMatchObject({ tabId: liveTabId });
});

it('puts the Pinned Tab back to rest when its live tab closes in the tab strip', async () => {
  const { items, unpinned } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await pin(await tabOf('https://a.test/'));

  await browser.tabs.remove(await idOf('https://a.test/'));
  await settle();

  expect(items()).toHaveLength(1);
  expect(items()[0]?.live).toBeUndefined();
  expect(unpinned()).toEqual(['https://b.test/']);
});

it('puts the Pinned Tab back to rest when the panel closes its live tab', async () => {
  const { panel, items } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await pin(await tabOf('https://a.test/'));

  panel.send({ type: 'tab/close', tabId: items()[0]?.live?.tabId as number });
  await settle();

  expect(await browser.tabs.query({ url: 'https://a.test/' })).toHaveLength(0);
  expect(items()[0]?.live).toBeUndefined();
});

it('puts the Pinned Tab back to rest when the window of its live tab closes', async () => {
  const { windows, items, unpinned } = await connectedPanel([
    ['https://a.test/'],
    ['https://b.test/'],
  ]);
  await pin(await tabOf('https://b.test/'));

  await browser.windows.remove(windows[1] as number);
  await settle();

  expect(items()[0]?.live).toBeUndefined();
  expect(unpinned()).toEqual(['https://a.test/']);
});

it('keeps the live tab when Chrome replaces its tab', async () => {
  const { items, unpinned } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await pin(await tabOf('https://a.test/'));
  const old = items()[0]?.live?.tabId as number;
  const replacement = (await browser.tabs.create({ url: 'https://a.test/' })).id as number;

  await fakeChrome.events.tabs.onReplaced.trigger(replacement, old);
  await settle();

  expect(items()[0]?.live?.tabId).toBe(replacement);
  expect(unpinned()).toEqual(['https://a.test/', 'https://b.test/']);
});

it('shows the saved title and the current title after the live tab navigated away', async () => {
  const { items } = await connectedPanel([['https://a.test/']]);
  const tab = await tabOf('https://a.test/');
  await fakeChrome.patchTab(tab.id as number, { title: 'Inbox' });
  await pin(await tabOf('https://a.test/'));

  await fakeChrome.patchTab(tab.id as number, { url: 'https://a.test/mail/42', title: 'Mail 42' });
  await settle();

  expect(items()[0]).toMatchObject({
    title: 'Inbox',
    url: 'https://a.test/',
    live: { title: 'Mail 42', url: 'https://a.test/mail/42', away: true },
  });
});

it('does not call a live tab away when Chrome only adds a slash to the saved URL', async () => {
  await browser.storage.local.set({
    items: [
      {
        id: 'imported',
        kind: 'pinned',
        title: 'A',
        url: 'https://a.test',
        parentId: null,
        position: 0,
        collapsed: false,
      },
    ],
  });
  const { panel, items } = await connectedPanel([['https://c.test/']]);
  panel.send({ type: 'item/open', itemId: 'imported' });
  await settle();
  const tab = (await browser.tabs.query({ url: 'https://a.test' }))[0] as chrome.tabs.Tab;

  await fakeChrome.patchTab(tab.id as number, { url: 'https://a.test/' });
  await settle();

  expect(items()[0]?.live).toMatchObject({ tabId: tab.id, url: 'https://a.test/', away: false });
});

it('calls a live tab away when only the fragment differs', async () => {
  const { items } = await connectedPanel([['https://a.test/']]);
  const tab = await tabOf('https://a.test/');
  await pin(tab);

  await fakeChrome.patchTab(tab.id as number, { url: 'https://a.test/#top' });
  await settle();

  expect(items()[0]?.live?.away).toBe(true);
});

it('sends the live tab back to the saved URL on Reset', async () => {
  const { panel, items } = await connectedPanel([['https://a.test/']]);
  const tab = await tabOf('https://a.test/');
  await pin(tab);
  await fakeChrome.patchTab(tab.id as number, { url: 'https://a.test/mail/42' });
  await settle();

  panel.send({ type: 'item/reset', itemId: items()[0]?.id as string });
  await settle();

  expect((await browser.tabs.get(tab.id as number)).url).toBe('https://a.test/');
  expect(items()[0]?.live?.away).toBe(false);
});

it('does nothing on Reset when the Pinned Tab is at rest', async () => {
  const { windows, panel, items } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await pinnedAtRest('https://a.test/');

  panel.send({ type: 'item/reset', itemId: items()[0]?.id as string });
  await settle();

  expect(await urlsOf(windows[0] as number)).toEqual(['https://b.test/']);
  expect(items()[0]?.live).toBeUndefined();
});

it('renames a Pinned Tab and ignores a blank name', async () => {
  const { panel, items } = await connectedPanel([['https://a.test/']]);
  await pin(await tabOf('https://a.test/'));
  const itemId = items()[0]?.id as string;

  panel.send({ type: 'item/rename', itemId, title: '  Mail  ' });
  await settle();
  expect(items()[0]?.title).toBe('Mail');

  panel.send({ type: 'item/rename', itemId, title: '   ' });
  await settle();
  expect(items()[0]?.title).toBe('Mail');
});

it('deletes a Pinned Tab and leaves its live tab open as an Unpinned Tab', async () => {
  const { panel, items, unpinned } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await pin(await tabOf('https://a.test/'));

  panel.send({ type: 'item/delete', itemId: items()[0]?.id as string });
  await settle();

  expect(items()).toEqual([]);
  expect(unpinned()).toEqual(['https://a.test/', 'https://b.test/']);
});

it('keeps the Pinned Tabs and their live tabs after the service worker restarted', async () => {
  const { windows, items } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await pin(await tabOf('https://a.test/'));
  await pin(await tabOf('https://b.test/'));
  const kept = items()[0]?.live?.tabId;
  stopWorker();
  // The worker is stopped: this Chrome event reaches no listener.
  await browser.tabs.remove(await idOf('https://b.test/'));
  await settle();

  await startWorker();
  const reconnected = connectPanel(windows[0] as number);
  await settle();

  expect(reconnected.latest()?.items.map((item) => [item.url, item.live?.tabId])).toEqual([
    ['https://a.test/', kept],
    ['https://b.test/', undefined],
  ]);
  expect(reconnected.latest()?.unpinnedTabs).toEqual([]);
});

it('keeps the Pinned Tabs, at rest, after Chrome restarted', async () => {
  await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await pin(await tabOf('https://a.test/'));
  const stored = await browser.storage.local.get(null);
  stopWorker();

  // Chrome quits: tabs and session storage are gone, local storage stays.
  fakeChrome.reset();
  await browser.storage.local.set(stored);
  const window = await fakeChrome.openWindow(['https://b.test/', 'https://c.test/']);
  await startWorker();
  const panel = connectPanel(window);
  await settle();

  expect(panel.latest()?.items.map((item) => [item.url, item.live])).toEqual([
    ['https://a.test/', undefined],
  ]);
  expect(panel.latest()?.unpinnedTabs.map((tab) => tab.url)).toEqual([
    'https://b.test/',
    'https://c.test/',
  ]);
});
