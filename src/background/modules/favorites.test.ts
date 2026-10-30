import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';
import { LINK_GUARD_ORIGINS } from '../../link-guard/origins';
import type { CommandBody } from '../../panel/connection';
import { PANEL_PORT, type PortMessage } from '../../shared/protocol';
import type { ItemRecord } from '../../shared/types';

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
    favorites: () => (panel.latest()?.items ?? []).filter((item) => item.kind === 'favorite'),
    unpinned: () => panel.latest()?.unpinnedTabs.map((tab) => tab.url),
  };
}

/** Presses the "pin current tab" shortcut while this tab is the current one. */
async function pin(url: string) {
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', await tabOf(url));
  await settle();
}

/** Saves Favorites at rest, in this order, as the data of a profile that has them already. */
async function saveFavorites(...urls: string[]) {
  const records: ItemRecord[] = urls.map((url, position) => ({
    id: `favorite-${position}`,
    kind: 'favorite',
    title: `Favorite ${position}`,
    url,
    parentId: null,
    position,
    collapsed: false,
  }));
  await browser.storage.local.set({ items: records });
  await settle();
}

it('turns a Pinned Tab into a Favorite and keeps its live tab', async () => {
  const { panel, items, favorites } = await connectedPanel([
    ['https://a.test/', 'https://b.test/'],
  ]);
  await pin('https://a.test/');
  const pinned = items()[0] as ItemRecord;
  const liveTabId = await idOf('https://a.test/');

  panel.send({ type: 'item/favorite', itemId: pinned.id });
  await settle();

  expect(favorites()).toHaveLength(1);
  expect(favorites()[0]).toMatchObject({
    title: pinned.title,
    url: 'https://a.test/',
    parentId: null,
    live: { tabId: liveTabId },
  });
  expect(await browser.tabs.query({ url: 'https://a.test/' })).toHaveLength(1);
});

it('keeps the live tab of a Pinned Tab that sat inside a Folder', async () => {
  const { panel, items, favorites, unpinned } = await connectedPanel([['https://a.test/']]);
  await pin('https://a.test/');
  panel.send({ type: 'folder/create', title: 'Work', parentId: null });
  await settle();
  const folder = items().find((item) => item.kind === 'folder') as ItemRecord;
  panel.send({ type: 'item/move', itemId: items()[0]?.id as string, parentId: folder.id });
  await settle();
  expect(items().find((item) => item.url === 'https://a.test/')?.parentId).toBe(folder.id);

  panel.send({ type: 'item/favorite', itemId: items().find((i) => i.url)?.id as string });
  await settle();

  expect(favorites()[0]).toMatchObject({
    url: 'https://a.test/',
    parentId: null,
    live: { tabId: await idOf('https://a.test/') },
  });
  expect(unpinned()).toEqual([]);
});

it('puts a new Favorite after the Favorites that exist', async () => {
  const { panel, items, favorites } = await connectedPanel([
    ['https://a.test/', 'https://b.test/'],
  ]);
  await pin('https://a.test/');
  await pin('https://b.test/');

  panel.send({ type: 'item/favorite', itemId: items()[1]?.id as string });
  await settle();
  panel.send({ type: 'item/favorite', itemId: items()[0]?.id as string });
  await settle();

  expect(favorites().map((item) => item.url)).toEqual(['https://b.test/', 'https://a.test/']);
});

it('leaves a Folder and a Favorite as they are', async () => {
  const { panel, items, favorites } = await connectedPanel([['https://a.test/']]);
  panel.send({ type: 'folder/create', title: 'Work', parentId: null });
  await settle();
  const folder = items().find((item) => item.kind === 'folder') as ItemRecord;

  panel.send({ type: 'item/favorite', itemId: folder.id });
  await settle();
  expect(items().map((item) => item.kind)).toEqual(['folder']);

  await pin('https://a.test/');
  panel.send({
    type: 'item/favorite',
    itemId: items().find((item) => item.kind === 'pinned')?.id as string,
  });
  await settle();
  const saved = JSON.stringify(items());
  panel.send({ type: 'item/favorite', itemId: favorites()[0]?.id as string });
  await settle();

  expect(favorites()).toHaveLength(1);
  expect(JSON.stringify(items())).toBe(saved);
});

it('opens a Favorite at rest in the window of the panel, as its live tab', async () => {
  await saveFavorites('https://a.test/');
  const { windows, panel, favorites, unpinned } = await connectedPanel([
    ['https://b.test/'],
    ['https://c.test/'],
  ]);
  expect(favorites()[0]?.live).toBeUndefined();

  panel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
  await settle();

  expect(await urlsOf(windows[0] as number)).toEqual(['https://b.test/', 'https://a.test/']);
  expect(favorites()[0]?.live).toMatchObject({
    tabId: await idOf('https://a.test/'),
    windowId: windows[0],
    active: true,
  });
  expect(unpinned()).toEqual(['https://b.test/', 'https://c.test/']);
});

it('never makes a second tab for a Favorite that is open, in any window', async () => {
  await saveFavorites('https://a.test/');
  const { windows, panel, favorites } = await connectedPanel([
    ['https://b.test/'],
    ['https://c.test/'],
  ]);
  panel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
  await settle();
  const second = windows[1] as number;
  await fakeChrome.focusWindow(second);
  const secondPanel = connectPanel(second);
  await settle();

  secondPanel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
  secondPanel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
  await settle();

  expect(await browser.tabs.query({ url: 'https://a.test/' })).toHaveLength(1);
  expect(await urlsOf(second)).toEqual(['https://c.test/', 'https://a.test/']);
});

it('puts the Favorite back to rest when its live tab closes, from the panel or the tab strip', async () => {
  await saveFavorites('https://a.test/', 'https://b.test/');
  const { panel, favorites } = await connectedPanel([['https://c.test/']]);
  for (const favorite of favorites()) panel.send({ type: 'item/open', itemId: favorite.id });
  await settle();
  expect(favorites().map((item) => Boolean(item.live))).toEqual([true, true]);

  panel.send({ type: 'tab/close', tabId: favorites()[0]?.live?.tabId as number });
  await browser.tabs.remove(await idOf('https://b.test/'));
  await settle();

  expect(favorites().map((item) => item.live)).toEqual([undefined, undefined]);
  expect(favorites()).toHaveLength(2);
});

it('sends the live tab of a Favorite back to its saved URL with Reset', async () => {
  await saveFavorites('https://a.test/');
  const { panel, favorites } = await connectedPanel([['https://c.test/']]);
  panel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
  await settle();
  const liveTabId = await idOf('https://a.test/');
  await browser.tabs.update(liveTabId, { url: 'https://a.test/elsewhere' });
  await settle();
  expect(favorites()[0]?.live?.away).toBe(true);

  panel.send({ type: 'item/reset', itemId: favorites()[0]?.id as string });
  await settle();

  expect((await browser.tabs.get(liveTabId)).url).toBe('https://a.test/');
  expect(favorites()[0]?.live?.away).toBe(false);
});

it('renames a Favorite', async () => {
  await saveFavorites('https://a.test/');
  const { panel, favorites } = await connectedPanel([['https://c.test/']]);

  panel.send({ type: 'item/rename', itemId: favorites()[0]?.id as string, title: ' Mail ' });
  await settle();

  expect(favorites()[0]?.title).toBe('Mail');
});

it('deletes a Favorite and leaves its live tab open as an Unpinned Tab', async () => {
  await saveFavorites('https://a.test/');
  const { panel, favorites, unpinned } = await connectedPanel([['https://c.test/']]);
  panel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
  await settle();

  panel.send({ type: 'item/delete', itemId: favorites()[0]?.id as string });
  await settle();

  expect(favorites()).toEqual([]);
  expect(unpinned()).toEqual(['https://c.test/', 'https://a.test/']);
});

const TWELVE = Array.from({ length: 12 }, (_, n) => `https://fav-${n}.test/`);

/** Plays a panel that also keeps the notices that the worker sends it. */
function noticesOf(windowId: number) {
  const port = fakeChrome.connect(PANEL_PORT);
  const notices: string[] = [];
  port.onMessage.addListener((message) => {
    const { type, message: text } = message as Extract<PortMessage, { type: 'notice' }>;
    if (type === 'notice') notices.push(text);
  });
  return {
    notices,
    send: (command: CommandBody) => port.postMessage({ ...command, windowId }),
  };
}

it('refuses a 13th Favorite with a short notice and changes nothing', async () => {
  await saveFavorites(...TWELVE);
  const { windows, items, favorites } = await connectedPanel([['https://a.test/']]);
  await pin('https://a.test/');
  const pinned = items().find((item) => item.kind === 'pinned') as ItemRecord;
  const before = JSON.stringify(items());
  const panel = noticesOf(windows[0] as number);

  panel.send({ type: 'item/favorite', itemId: pinned.id });
  await settle();

  expect(favorites()).toHaveLength(12);
  expect(JSON.stringify(items())).toBe(before);
  expect(panel.notices).toEqual(['Sidesweep keeps 12 Favorites at most. Remove one first.']);
  expect((await browser.tabs.query({ url: 'https://a.test/' })).length).toBe(1);
});

it('sends the notice to the panel that asked, not to the others', async () => {
  await saveFavorites(...TWELVE);
  const { windows, items } = await connectedPanel([['https://a.test/'], ['https://b.test/']]);
  await pin('https://a.test/');
  const asking = noticesOf(windows[0] as number);
  const other = noticesOf(windows[1] as number);

  asking.send({
    type: 'item/favorite',
    itemId: items().find((item) => item.kind === 'pinned')?.id as string,
  });
  await settle();

  expect(asking.notices).toHaveLength(1);
  expect(other.notices).toEqual([]);
});

it('accepts a 12th Favorite, refuses the next one, and accepts it after a delete', async () => {
  await saveFavorites(...TWELVE.slice(0, 11));
  const { panel, items, favorites } = await connectedPanel([
    ['https://a.test/', 'https://b.test/'],
  ]);
  await pin('https://a.test/');
  await pin('https://b.test/');
  const [a, b] = items().filter((item) => item.kind === 'pinned') as unknown as [
    ItemRecord,
    ItemRecord,
  ];

  panel.send({ type: 'item/favorite', itemId: a.id });
  await settle();
  expect(favorites()).toHaveLength(12);

  panel.send({ type: 'item/favorite', itemId: b.id });
  await settle();
  expect(favorites().map((item) => item.url)).not.toContain('https://b.test/');

  panel.send({ type: 'item/delete', itemId: 'favorite-0' });
  panel.send({ type: 'item/favorite', itemId: b.id });
  await settle();

  expect(favorites().map((item) => item.url)).toContain('https://b.test/');
  expect(favorites()).toHaveLength(12);
});

it('counts a Favorite that is added by code in the limit too', async () => {
  await saveFavorites(...TWELVE);
  await connectedPanel([['https://a.test/']]);
  const { addItem, FavoriteLimitError } = await import('./item-store');

  await expect(addItem({ kind: 'favorite', title: 'A', url: 'https://a.test/' })).rejects.toThrow(
    FavoriteLimitError,
  );
  expect(((await browser.storage.local.get('items')).items as ItemRecord[]).length).toBe(12);
});

it('turns a Favorite into a Pinned Tab at the root, after the Pinned Tabs, with its live tab', async () => {
  await saveFavorites('https://a.test/');
  const { panel, items, favorites } = await connectedPanel([['https://b.test/']]);
  await pin('https://b.test/');
  panel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
  await settle();
  const liveTabId = await idOf('https://a.test/');

  panel.send({ type: 'item/move', itemId: favorites()[0]?.id as string, parentId: null });
  await settle();

  expect(favorites()).toEqual([]);
  expect(items().map((item) => [item.kind, item.url, item.parentId])).toEqual([
    ['pinned', 'https://b.test/', null],
    ['pinned', 'https://a.test/', null],
  ]);
  expect(items()[1]?.live).toMatchObject({ tabId: liveTabId });
});

it('turns a Favorite into a Pinned Tab inside a Folder', async () => {
  await saveFavorites('https://a.test/');
  const { panel, items, favorites } = await connectedPanel([['https://b.test/']]);
  panel.send({ type: 'folder/create', title: 'Work', parentId: null });
  await settle();
  const folder = items().find((item) => item.kind === 'folder') as ItemRecord;

  panel.send({ type: 'item/move', itemId: favorites()[0]?.id as string, parentId: folder.id });
  await settle();

  expect(favorites()).toEqual([]);
  expect(items().find((item) => item.url === 'https://a.test/')).toMatchObject({
    kind: 'pinned',
    parentId: folder.id,
  });
});

// A Favorite shares the live tab registry with the Pinned Tabs: these tests check the modules that read it.

/** Chrome quits and starts again, then restores one window with these tabs. */
async function restartBrowser(restored: string[]) {
  stopWorker();
  await fakeChrome.restartBrowser();
  const windowId = await fakeChrome.openWindow(restored);
  await startWorker();
  await (browser.runtime.onStartup as unknown as { trigger(): Promise<void> }).trigger();
  const panel = connectPanel(windowId);
  await settle();
  return panel;
}

const savedItem = (id: string, kind: ItemRecord['kind'], url: string, position: number) => ({
  id,
  kind,
  title: id,
  url,
  parentId: null,
  position,
  collapsed: false,
});

it('links a restored tab to the Favorite with the same URL', async () => {
  await saveFavorites('https://a.test/');

  const panel = await restartBrowser(['https://b.test/', 'https://a.test/']);

  const [favorite] = panel.latest()?.items ?? [];
  expect(favorite?.live?.tabId).toBe(await idOf('https://a.test/'));
  expect(panel.latest()?.unpinnedTabs.map((tab) => tab.url)).toEqual(['https://b.test/']);
});

it('links one restored tab to one item when a Favorite and a Pinned Tab share a URL', async () => {
  await browser.storage.local.set({
    items: [
      savedItem('pinned', 'pinned', 'https://a.test/', 0),
      savedItem('favorite', 'favorite', 'https://a.test/', 0),
    ],
  });

  const panel = await restartBrowser(['https://a.test/']);

  const linked = panel.latest()?.items.filter((item) => item.live) ?? [];
  expect(linked.map((item) => item.id)).toEqual(['favorite']);
  expect(panel.latest()?.unpinnedTabs).toEqual([]);
});

it('links two restored tabs to a Favorite and a Pinned Tab that share a URL, one each', async () => {
  await browser.storage.local.set({
    items: [
      savedItem('pinned', 'pinned', 'https://a.test/', 0),
      savedItem('favorite', 'favorite', 'https://a.test/', 0),
    ],
  });

  const panel = await restartBrowser(['https://a.test/', 'https://a.test/']);

  const tabs = (panel.latest()?.items ?? []).map((item) => item.live?.tabId);
  expect(tabs.every((tabId) => tabId !== undefined)).toBe(true);
  expect(new Set(tabs).size).toBe(2);
});

it('tells the link guard that the tab of a Favorite is a live tab', async () => {
  fakeChrome.grantedOrigins = [...LINK_GUARD_ORIGINS];
  await saveFavorites('https://a.test/');
  const { panel, favorites } = await connectedPanel([['https://b.test/']]);
  panel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
  await settle();

  const isLive = (tabId: number) =>
    fakeChrome.messageFromTab(tabId, { rpc: 'link-guard/is-live', request: null });

  expect(await isLive(await idOf('https://a.test/'))).toBe(true);
  expect(await isLive(await idOf('https://b.test/'))).toBe(false);
});

it('never pins the live tab of a Favorite again', async () => {
  await saveFavorites('https://a.test/');
  const { panel, items, favorites } = await connectedPanel([['https://b.test/']]);
  panel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
  await settle();

  await pin('https://a.test/');

  expect(items().map((item) => item.kind)).toEqual(['favorite']);
});

it('never closes the live tab of a Favorite with Auto Archive or Clear', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    await saveFavorites('https://a.test/');
    const { windows, panel, favorites } = await connectedPanel([
      ['https://idle.test/', 'https://on-screen.test/'],
    ]);
    panel.send({ type: 'item/open', itemId: favorites()[0]?.id as string });
    await settle();
    // The Favorite is on screen now: move another tab on screen, then let every tab get old.
    const idle = await idOf('https://idle.test/');
    await browser.tabs.update(idle, { active: true });
    for (const tab of await browser.tabs.query({}))
      fakeChrome.setLastAccessed(tab.id as number, Date.now() - 13 * 3600 * 1000);

    await (browser.alarms.onAlarm as unknown as { trigger(alarm: object): Promise<void> }).trigger({
      name: 'auto-archive',
      scheduledTime: Date.now(),
    });
    await settle();

    expect(await browser.tabs.query({ url: 'https://a.test/' })).toHaveLength(1);
    expect(await browser.tabs.query({ url: 'https://on-screen.test/' })).toHaveLength(0);

    panel.send({ type: 'tab/clear' });
    await settle();

    expect(await urlsOf(windows[0] as number)).toContain('https://a.test/');
    expect(favorites()[0]?.live).toBeDefined();
  } finally {
    vi.useRealTimers();
  }
});
