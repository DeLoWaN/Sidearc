import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';
import type { ItemRecord } from '../../shared/types';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0]?.id as number;

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

const TABS = ['https://t1.test/', 'https://t2.test/', 'https://t3.test/'];

/** Saves the items, opens a window with the URLs, and connects a panel in it. */
async function connectedPanel(records: ItemRecord[], urls: string[] = TABS) {
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
    /** The ids inside one parent, in position order. */
    order: (parentId: string | null) =>
      (panel.latest()?.items ?? [])
        .filter((item) => item.parentId === parentId && item.kind !== 'favorite')
        .sort((a, b) => a.position - b.position)
        .map((item) => item.id),
    items: () => panel.latest()?.items ?? [],
  };
}

const FLAT = [
  record('a', 'pinned', null, 0),
  record('b', 'pinned', null, 1),
  record('c', 'pinned', null, 2),
  record('d', 'pinned', null, 3),
  record('work', 'folder', null, 4),
  record('w1', 'pinned', 'work', 0),
];

it('moves Pinned Tabs into a Folder in the given order, at the end without an index', async () => {
  const { send, order } = await connectedPanel(FLAT);

  await send({
    type: 'selection/move',
    tabIds: [],
    itemIds: ['c', 'a'],
    target: { kind: 'pinned', parentId: 'work' },
  });

  expect(order('work')).toEqual(['w1', 'c', 'a']);
  expect(order(null)).toEqual(['b', 'd', 'work']);
});

it('counts the index of a move without the moved items', async () => {
  const { send, order } = await connectedPanel(FLAT);

  await send({
    type: 'selection/move',
    tabIds: [],
    itemIds: ['b', 'c'],
    target: { kind: 'pinned', parentId: null, index: 2 },
  });

  expect(order(null)).toEqual(['a', 'd', 'b', 'c', 'work']);
});

it('moves Unpinned Tabs, after the items, into a Folder and makes Pinned Tabs that keep their live tab', async () => {
  const { send, order, items, state } = await connectedPanel(FLAT);
  const [t1, t2] = [await tabOf(TABS[0] as string), await tabOf(TABS[1] as string)];

  await send({
    type: 'selection/move',
    tabIds: [t1, t2],
    itemIds: ['a'],
    target: { kind: 'pinned', parentId: 'work', index: 0 },
  });

  const inWork = order('work');
  expect(inWork).toHaveLength(4);
  expect(inWork[0]).toBe('a');
  expect(inWork[3]).toBe('w1');
  const made = items().filter((item) => inWork.slice(1, 3).includes(item.id));
  expect(made.map((item) => item.url)).toEqual([TABS[0], TABS[1]]);
  expect(made.map((item) => item.live?.tabId)).toEqual([t1, t2]);
  expect(state()?.unpinnedTabs.map((tab) => tab.url)).toEqual([TABS[2]]);
});

it('refuses a Folder moved into itself or into its content, with no change and no undo entry', async () => {
  const records = [
    record('work', 'folder', null, 0),
    record('inner', 'folder', 'work', 0),
    record('i1', 'pinned', 'inner', 0),
    record('other', 'pinned', null, 1),
  ];
  const { send, order, state } = await connectedPanel(records);

  for (const parentId of ['work', 'inner']) {
    await send({
      type: 'selection/move',
      tabIds: [],
      itemIds: ['other', 'work'],
      target: { kind: 'pinned', parentId },
    });
  }

  expect(order(null)).toEqual(['work', 'other']);
  expect(order('work')).toEqual(['inner']);
  expect(state()?.undo).toBeNull();
});

it('refuses a target that is not a Folder', async () => {
  const { send, order, state } = await connectedPanel(FLAT);

  await send({
    type: 'selection/move',
    tabIds: [],
    itemIds: ['a'],
    target: { kind: 'pinned', parentId: 'b' },
  });

  expect(order(null)).toEqual(['a', 'b', 'c', 'd', 'work']);
  expect(state()?.undo).toBeNull();
});

it('moves a selected Folder with its content and ignores a selected item inside it', async () => {
  const records = [
    record('work', 'folder', null, 0),
    record('w1', 'pinned', 'work', 0),
    record('dest', 'folder', null, 1),
  ];
  const { send, order } = await connectedPanel(records);

  await send({
    type: 'selection/move',
    tabIds: [],
    itemIds: ['w1', 'work'],
    target: { kind: 'pinned', parentId: 'dest' },
  });

  expect(order('dest')).toEqual(['work']);
  expect(order('work')).toEqual(['w1']);
});

it('moves Pinned Tabs to the Unpinned Tabs: a live tab stays, an item at rest opens its URL, an Unpinned Tab stays', async () => {
  const { send, state, order, windowId } = await connectedPanel(FLAT);
  await send({ type: 'item/open', itemId: 'a' });
  const t1 = await tabOf(TABS[0] as string);

  await send({
    type: 'selection/move',
    tabIds: [t1],
    itemIds: ['a', 'b'],
    target: { kind: 'unpinned' },
  });

  expect(order(null)).toEqual(['c', 'd', 'work']);
  const urls = (await browser.tabs.query({ windowId })).map((tab) => tab.url);
  expect(urls).toEqual(expect.arrayContaining(['https://a.test/', 'https://b.test/', TABS[0]]));
  expect(state()?.unpinnedTabs.map((tab) => tab.url)).toEqual(
    expect.arrayContaining(['https://a.test/', 'https://b.test/', TABS[0]]),
  );
});

it('refuses a Folder in the selection when the target is the Unpinned Tabs', async () => {
  const { send, order, state } = await connectedPanel(FLAT);

  await send({
    type: 'selection/move',
    tabIds: [],
    itemIds: ['a', 'work'],
    target: { kind: 'unpinned' },
  });

  expect(order(null)).toEqual(['a', 'b', 'c', 'd', 'work']);
  expect(state()?.undo).toBeNull();
});

it('puts Unpinned Tabs in a Tab group, and refuses a Pinned Tab for that target', async () => {
  const { send, state, windowId } = await connectedPanel(FLAT, [...TABS, 'https://t4.test/']);
  const [t1, t2, t3, t4] = await Promise.all(
    [...TABS, 'https://t4.test/'].map((url) => tabOf(url)),
  );
  const groupId = await (browser.tabs.group({ tabIds: [t4 as number] }) as Promise<number>);

  await send({
    type: 'selection/move',
    tabIds: [t1 as number, t3 as number],
    itemIds: ['a'],
    target: { kind: 'tab-group', groupId },
  });
  expect(state()?.tabGroups[0]?.tabIds).toEqual([t4]);
  expect(state()?.items.some((item) => item.id === 'a')).toBe(true);

  await send({
    type: 'selection/move',
    tabIds: [t1 as number, t3 as number],
    itemIds: [],
    target: { kind: 'tab-group', groupId },
  });

  const group = state()?.tabGroups[0];
  expect([...(group?.tabIds ?? [])].sort()).toEqual([t1, t3, t4].sort());
  expect(t2).toBeDefined();
  expect((await browser.tabs.query({ windowId, groupId })).length).toBe(3);
});

it('puts Unpinned Tabs in a site group, takes them out of their Tab group, and refuses a Pinned Tab', async () => {
  const { send, state, windowId } = await connectedPanel(FLAT, ['https://docs.test/a']);
  const opener = await tabOf('https://docs.test/a');
  for (const url of ['https://docs.test/b', 'https://docs.test/c']) {
    await browser.tabs.create({ url, windowId, active: false, openerTabId: opener });
    await settle();
  }
  await browser.tabs.create({ url: 'https://x.test/', windowId, active: false });
  await browser.tabs.create({ url: 'https://y.test/', windowId, active: false });
  await settle();
  const [x, y] = [await tabOf('https://x.test/'), await tabOf('https://y.test/')];
  const tabGroup = await (browser.tabs.group({ tabIds: [y] }) as Promise<number>);
  await settle();
  const siteGroup = state()?.siteGroups[0];
  expect(siteGroup?.tabIds).toHaveLength(3);

  await send({
    type: 'selection/move',
    tabIds: [x],
    itemIds: ['a'],
    target: { kind: 'site-group', groupId: siteGroup?.id as string },
  });
  expect(state()?.siteGroups[0]?.tabIds).toHaveLength(3);

  await send({
    type: 'selection/move',
    tabIds: [x, y],
    itemIds: [],
    target: { kind: 'site-group', groupId: siteGroup?.id as string },
  });

  expect(state()?.siteGroups[0]?.tabIds).toEqual(expect.arrayContaining([x, y]));
  expect(state()?.siteGroups[0]?.tabIds).toHaveLength(5);
  expect((await browser.tabs.get(y)).groupId).not.toBe(tabGroup);
});

it('ignores unknown ids and Favorites', async () => {
  const { send, order, state } = await connectedPanel([
    ...FLAT,
    record('fav', 'favorite', null, 0),
  ]);

  await send({
    type: 'selection/move',
    tabIds: [9999],
    itemIds: ['nope', 'fav'],
    target: { kind: 'pinned', parentId: 'work' },
  });

  expect(order('work')).toEqual(['w1']);
  expect(state()?.items.find((item) => item.id === 'fav')?.kind).toBe('favorite');
  expect(state()?.undo).toBeNull();
});

it('adds ONE undo entry labelled with the number of items, and undo reverts the whole move', async () => {
  const { send, order, state } = await connectedPanel(FLAT);
  const t1 = await tabOf(TABS[0] as string);

  await send({
    type: 'selection/move',
    tabIds: [t1],
    itemIds: ['a', 'b'],
    target: { kind: 'pinned', parentId: 'work' },
  });
  expect(state()?.undo).toEqual({ label: 'Move 3 items' });
  expect(order('work')).toHaveLength(4);

  await send({ type: 'undo' });

  expect(order('work')).toEqual(['w1']);
  expect(order(null)).toEqual(['a', 'b', 'c', 'd', 'work']);
  expect(state()?.undo).toBeNull();
});
