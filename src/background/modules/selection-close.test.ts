import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';
import type { ItemRecord } from '../../shared/types';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0]?.id as number;
const urlsOf = async (windowId: number) =>
  (await browser.tabs.query({ windowId })).map((tab) => tab.url);

function record(
  id: string,
  kind: ItemRecord['kind'],
  parentId: string | null,
  position: number,
): ItemRecord {
  return {
    id,
    kind,
    title: id,
    url: kind === 'folder' ? '' : `https://${id}.test/`,
    parentId,
    position,
    collapsed: false,
  };
}

/** Saves the items, opens a window with the URLs, and connects a panel in it. */
async function connectedPanel(records: ItemRecord[], urls: string[]) {
  await browser.storage.local.set({ items: records });
  const windowId = await fakeChrome.openWindow(urls);
  const panel = connectPanel(windowId);
  await settle();
  return {
    windowId,
    send: async (command: Parameters<typeof panel.send>[0]) => {
      panel.send(command);
      await settle();
    },
    state: () => panel.latest(),
    items: () => panel.latest()?.items ?? [],
  };
}

const TABS = ['https://t1.test/', 'https://t2.test/', 'https://t3.test/', 'https://t4.test/'];

it('closes the Unpinned Tabs with one tabs.remove call and leaves the other tabs', async () => {
  const { windowId, send } = await connectedPanel([], TABS);
  const remove = vi.spyOn(browser.tabs, 'remove');
  const [t1, t3] = [await tabOf(TABS[0] as string), await tabOf(TABS[2] as string)];

  await send({ type: 'selection/close', tabIds: [t1, t3], itemIds: [] });

  expect(await urlsOf(windowId)).toEqual([TABS[1], TABS[3]]);
  expect(remove).toHaveBeenCalledTimes(1);
});

it('deletes the Pinned Tabs and the Folders with their content', async () => {
  const { send, items } = await connectedPanel(
    [
      record('a', 'pinned', null, 0),
      record('work', 'folder', null, 1),
      record('w1', 'pinned', 'work', 0),
      record('keep', 'pinned', null, 2),
    ],
    TABS,
  );

  await send({ type: 'selection/close', tabIds: [], itemIds: ['a', 'work'] });

  expect(items().map((item) => item.id)).toEqual(['keep']);
});

it('keeps the live tab of a deleted Pinned Tab open as an Unpinned Tab', async () => {
  const { windowId, send, items, state } = await connectedPanel(
    [record('a', 'pinned', null, 0)],
    TABS,
  );
  await send({ type: 'item/open', itemId: 'a' });
  expect(items()[0]?.live).toBeDefined();

  await send({ type: 'selection/close', tabIds: [], itemIds: ['a'] });

  expect(items()).toEqual([]);
  expect(await urlsOf(windowId)).toContain('https://a.test/');
  expect(state()?.unpinnedTabs.map((tab) => tab.url)).toContain('https://a.test/');
});

it('counts an item below a selected Folder through the Folder', async () => {
  const { send, items, state } = await connectedPanel(
    [
      record('work', 'folder', null, 0),
      record('w1', 'pinned', 'work', 0),
      record('inner', 'folder', 'work', 1),
      record('deep', 'pinned', 'inner', 0),
    ],
    TABS,
  );

  await send({ type: 'selection/close', tabIds: [], itemIds: ['w1', 'work', 'deep'] });

  expect(items()).toEqual([]);
  expect(state()?.undo).toEqual({ label: 'Close 1 item' });
});

it('ignores unknown ids, Favorites and the live tab of an item, and adds no undo entry when nothing happened', async () => {
  const { windowId, send, state, items } = await connectedPanel(
    [record('fav', 'favorite', null, 0), record('a', 'pinned', null, 1)],
    TABS,
  );
  await send({ type: 'item/open', itemId: 'a' });
  const liveTab = items().find((item) => item.id === 'a')?.live?.tabId as number;
  const before = await urlsOf(windowId);

  await send({ type: 'selection/close', tabIds: [9999, liveTab], itemIds: ['nope', 'fav'] });

  expect(await urlsOf(windowId)).toEqual(before);
  expect(items().map((item) => item.id)).toEqual(['fav', 'a']);
  expect(state()?.undo).toBeNull();
});

it('adds ONE undo entry labelled with the number of items, and undo restores the items and reopens the tabs in place', async () => {
  const { windowId, send, state, items } = await connectedPanel(
    [
      record('a', 'pinned', null, 0),
      record('work', 'folder', null, 1),
      record('w1', 'pinned', 'work', 0),
    ],
    TABS,
  );
  const before = await urlsOf(windowId);
  const [t2, t3] = [await tabOf(TABS[1] as string), await tabOf(TABS[2] as string)];

  await send({ type: 'selection/close', tabIds: [t2, t3], itemIds: ['a', 'work'] });

  expect(state()?.undo).toEqual({ label: 'Close 4 items' });
  expect(items()).toEqual([]);
  expect(await urlsOf(windowId)).toEqual([TABS[0], TABS[3]]);

  await send({ type: 'undo' });

  expect(items().map((item) => item.id)).toEqual(['a', 'w1', 'work']);
  expect(await urlsOf(windowId)).toEqual(before);
  const reopened = (await browser.tabs.query({ windowId })).filter((tab) =>
    [TABS[1], TABS[2]].includes(tab.url),
  );
  expect(reopened.every((tab) => !tab.active && tab.openerTabId === undefined)).toBe(true);
  // One entry only: nothing is left to undo.
  expect(state()?.undo).toBeNull();
});

it('reopens the closed tabs in the panel window when their window is gone', async () => {
  const { windowId, send } = await connectedPanel([], TABS);
  const other = await fakeChrome.openWindow(['https://o1.test/', 'https://o2.test/']);
  const o1 = await tabOf('https://o1.test/');
  await send({
    type: 'selection/close',
    tabIds: [o1, await tabOf('https://o2.test/')],
    itemIds: [],
  });
  expect(await browser.windows.getAll().then((all) => all.map((w) => w.id))).not.toContain(other);

  await send({ type: 'undo' });

  expect(await urlsOf(windowId)).toEqual(
    expect.arrayContaining(['https://o1.test/', 'https://o2.test/']),
  );
});
