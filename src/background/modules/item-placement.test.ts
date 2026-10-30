import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';
import { PANEL_PORT, type PortMessage } from '../../shared/protocol';
import type { ItemRecord } from '../../shared/types';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

let seeded = 0;

/** A saved item. `order` is the position among its siblings. */
function record(
  id: string,
  kind: ItemRecord['kind'],
  parentId: string | null,
  order: number,
): ItemRecord {
  seeded += 1;
  return {
    id,
    kind,
    title: id,
    url: kind === 'folder' ? '' : `https://${id}-${seeded}.test/`,
    parentId,
    position: order,
    collapsed: false,
  };
}

async function connectedPanel(records: ItemRecord[], urls: string[] = ['https://home.test/']) {
  await browser.storage.local.set({ items: records });
  const windowId = await fakeChrome.openWindow(urls);
  const panel = connectPanel(windowId);
  await settle();
  const items = () => panel.latest()?.items ?? [];
  return {
    windowId,
    panel,
    items,
    /** The ids inside one parent (null for the root), by position, with the kind filter. */
    order: (parentId: string | null, kinds: ItemRecord['kind'][] = ['pinned', 'folder']) =>
      items()
        .filter((item) => item.parentId === parentId && kinds.includes(item.kind))
        .sort((a, b) => a.position - b.position)
        .map((item) => item.id),
    positions: (parentId: string | null, kinds: ItemRecord['kind'][] = ['pinned', 'folder']) =>
      items()
        .filter((item) => item.parentId === parentId && kinds.includes(item.kind))
        .sort((a, b) => a.position - b.position)
        .map((item) => item.position),
  };
}

const root = [
  record('a', 'pinned', null, 0),
  record('b', 'pinned', null, 1),
  record('c', 'pinned', null, 2),
  record('d', 'pinned', null, 3),
];

it('puts an item at the index inside its own parent', async () => {
  const { panel, order, positions } = await connectedPanel(root);

  panel.send({ type: 'item/move', itemId: 'a', parentId: null, index: 2 });
  await settle();

  expect(order(null)).toEqual(['b', 'c', 'a', 'd']);
  expect(positions(null)).toEqual([0, 1, 2, 3]);
});

it('moves an item up inside its own parent', async () => {
  const { panel, order } = await connectedPanel(root);

  panel.send({ type: 'item/move', itemId: 'd', parentId: null, index: 0 });
  await settle();

  expect(order(null)).toEqual(['d', 'a', 'b', 'c']);
});

it('inserts an item at the index of another Folder and renumbers both Folders', async () => {
  const { panel, order, positions } = await connectedPanel([
    record('work', 'folder', null, 0),
    record('w1', 'pinned', 'work', 0),
    record('w2', 'pinned', 'work', 1),
    record('home', 'folder', null, 1),
    record('h1', 'pinned', 'home', 0),
    record('h2', 'pinned', 'home', 1),
  ]);

  panel.send({ type: 'item/move', itemId: 'w1', parentId: 'home', index: 1 });
  await settle();

  expect(order('home')).toEqual(['h1', 'w1', 'h2']);
  expect(positions('home')).toEqual([0, 1, 2]);
  expect(order('work')).toEqual(['w2']);
  expect(positions('work')).toEqual([0]);
});

it('puts the item at the end when the index is past the end', async () => {
  const { panel, order } = await connectedPanel(root);

  panel.send({ type: 'item/move', itemId: 'a', parentId: null, index: 99 });
  await settle();

  expect(order(null)).toEqual(['b', 'c', 'd', 'a']);
});

it('turns a Favorite into a Pinned Tab at the index, and keeps the other Favorites in order', async () => {
  const { panel, order, positions } = await connectedPanel([
    ...root,
    record('f1', 'favorite', null, 0),
    record('f2', 'favorite', null, 1),
    record('f3', 'favorite', null, 2),
  ]);

  panel.send({ type: 'item/move', itemId: 'f2', parentId: null, index: 1 });
  await settle();

  expect(order(null)).toEqual(['a', 'f2', 'b', 'c', 'd']);
  expect(positions(null)).toEqual([0, 1, 2, 3, 4]);
  expect(order(null, ['favorite'])).toEqual(['f1', 'f3']);
  expect(positions(null, ['favorite'])).toEqual([0, 1]);
});

it('refuses an index inside a Folder that the item holds', async () => {
  const { panel, order } = await connectedPanel([
    record('work', 'folder', null, 0),
    record('inner', 'folder', 'work', 0),
    record('x', 'pinned', null, 1),
  ]);

  panel.send({ type: 'item/move', itemId: 'work', parentId: 'inner', index: 0 });
  await settle();

  expect(order(null)).toEqual(['work', 'x']);
  expect(order('work')).toEqual(['inner']);
});

const favorites = [
  record('f1', 'favorite', null, 0),
  record('f2', 'favorite', null, 1),
  record('f3', 'favorite', null, 2),
];

it('turns a Pinned Tab into a Favorite at the index, and renumbers the Pinned Tabs', async () => {
  const { panel, order, positions } = await connectedPanel([...root, ...favorites]);

  panel.send({ type: 'item/favorite', itemId: 'b', index: 1 });
  await settle();

  expect(order(null, ['favorite'])).toEqual(['f1', 'b', 'f2', 'f3']);
  expect(positions(null, ['favorite'])).toEqual([0, 1, 2, 3]);
  expect(order(null)).toEqual(['a', 'c', 'd']);
  expect(positions(null)).toEqual([0, 1, 2]);
});

it('moves a Favorite to the index among the Favorites', async () => {
  const { panel, order, positions } = await connectedPanel([...root, ...favorites]);

  panel.send({ type: 'item/favorite', itemId: 'f1', index: 2 });
  await settle();

  expect(order(null, ['favorite'])).toEqual(['f2', 'f3', 'f1']);
  expect(positions(null, ['favorite'])).toEqual([0, 1, 2]);
  expect(order(null)).toEqual(['a', 'b', 'c', 'd']);
});

it('leaves a Favorite where it is when the command has no index', async () => {
  const { panel, order } = await connectedPanel([...root, ...favorites]);

  panel.send({ type: 'item/favorite', itemId: 'f1' });
  await settle();

  expect(order(null, ['favorite'])).toEqual(['f1', 'f2', 'f3']);
});

it('sends a notice and changes nothing for a 13th Favorite that comes with an index', async () => {
  const twelve = Array.from({ length: 12 }, (_, i) => record(`fav-${i}`, 'favorite', null, i));
  const { windowId, order } = await connectedPanel([...root, ...twelve]);
  const notices: string[] = [];
  const port = fakeChrome.connect(PANEL_PORT);
  port.onMessage.addListener((message) => {
    const received = message as PortMessage;
    if (received.type === 'notice') notices.push(received.message);
  });

  port.postMessage({ type: 'item/favorite', itemId: 'a', index: 0, windowId });
  await settle();

  expect(notices).toHaveLength(1);
  expect(order(null)).toEqual(['a', 'b', 'c', 'd']);
  expect(order(null, ['favorite'])).toHaveLength(12);
});
