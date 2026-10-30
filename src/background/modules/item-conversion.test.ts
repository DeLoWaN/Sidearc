import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';
import { PANEL_PORT, type PortMessage } from '../../shared/protocol';
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
  url = kind === 'folder' ? '' : `https://${id}.test/`,
): ItemRecord {
  return { id, kind, title: id, url, parentId, position, collapsed: false };
}

/** Saves the items, opens a window with the URLs and connects a panel in it. */
async function connectedPanel(records: ItemRecord[], urls: string[]) {
  await browser.storage.local.set({ items: records });
  const windowId = await fakeChrome.openWindow(urls);
  const panel = connectPanel(windowId);
  const notices: string[] = [];
  const noticePort = fakeChrome.connect(PANEL_PORT);
  noticePort.onMessage.addListener((message) => {
    const received = message as PortMessage;
    if (received.type === 'notice') notices.push(received.message);
  });
  await settle();
  return {
    windowId,
    panel,
    notices,
    /** Sends a command from a second port, the one that receives the notices. */
    sendWithNotice(command: Record<string, unknown>) {
      noticePort.postMessage({ ...command, windowId });
    },
    items: () => panel.latest()?.items ?? [],
    unpinned: () => panel.latest()?.unpinnedTabs.map((tab) => tab.url),
  };
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

it('makes a Pinned Tab from an Unpinned Tab at an index, with its URL and title, and the tab becomes its live tab', async () => {
  const { panel, items, unpinned } = await connectedPanel(
    [record('a', 'pinned', null, 0), record('b', 'pinned', null, 1)],
    ['https://home.test/', 'https://new.test/'],
  );
  const tabId = await tabOf('https://new.test/');

  panel.send({ type: 'item/from-tab', tabId, kind: 'pinned', parentId: null, index: 1 });
  await settle();

  const root = items().filter((item) => item.parentId === null);
  expect(ids(root).slice(0, 1)).toEqual(['a']);
  expect(root.map((item) => item.position)).toEqual([0, 1, 2]);
  expect(root[1]).toMatchObject({
    kind: 'pinned',
    url: 'https://new.test/',
    live: { tabId },
  });
  expect(root[2]?.id).toBe('b');
  expect(unpinned()).toEqual(['https://home.test/']);
  expect(await browser.tabs.query({ url: 'https://new.test/' })).toHaveLength(1);
});

it('makes a Pinned Tab inside a Folder, at the end without an index', async () => {
  const { panel, items } = await connectedPanel(
    [record('work', 'folder', null, 0), record('w1', 'pinned', 'work', 0)],
    ['https://home.test/', 'https://new.test/'],
  );

  panel.send({
    type: 'item/from-tab',
    tabId: await tabOf('https://new.test/'),
    kind: 'pinned',
    parentId: 'work',
  });
  await settle();

  const inWork = items().filter((item) => item.parentId === 'work');
  expect(inWork.map((item) => item.url)).toEqual(['https://w1.test/', 'https://new.test/']);
});

it('makes a Favorite from an Unpinned Tab at an index', async () => {
  const { panel, items, unpinned } = await connectedPanel(
    [record('f1', 'favorite', null, 0), record('f2', 'favorite', null, 1)],
    ['https://home.test/', 'https://new.test/'],
  );

  panel.send({
    type: 'item/from-tab',
    tabId: await tabOf('https://new.test/'),
    kind: 'favorite',
    parentId: null,
    index: 0,
  });
  await settle();

  const favorites = items().filter((item) => item.kind === 'favorite');
  expect(favorites.map((item) => [item.url, item.position])).toEqual([
    ['https://new.test/', 0],
    ['https://f1.test/', 1],
    ['https://f2.test/', 2],
  ]);
  expect(favorites[0]?.live).toBeDefined();
  expect(unpinned()).toEqual(['https://home.test/']);
});

it('refuses a 13th Favorite with a notice, and the tab stays an Unpinned Tab', async () => {
  const twelve = Array.from({ length: 12 }, (_, i) => record(`fav-${i}`, 'favorite', null, i));
  const { items, notices, sendWithNotice, unpinned } = await connectedPanel(twelve, [
    'https://home.test/',
    'https://new.test/',
  ]);

  sendWithNotice({
    type: 'item/from-tab',
    tabId: await tabOf('https://new.test/'),
    kind: 'favorite',
    parentId: null,
  });
  await settle();

  expect(notices).toHaveLength(1);
  expect(items()).toHaveLength(12);
  expect(unpinned()).toContain('https://new.test/');
});

it('ignores a tab that already is the live tab of an item', async () => {
  const { panel, items } = await connectedPanel(
    [record('a', 'pinned', null, 0, 'https://a.test/')],
    ['https://home.test/'],
  );
  panel.send({ type: 'item/open', itemId: 'a' });
  await settle();

  panel.send({
    type: 'item/from-tab',
    tabId: await tabOf('https://a.test/'),
    kind: 'pinned',
    parentId: null,
  });
  await settle();

  expect(items()).toHaveLength(1);
});

it('ignores a parent that is not a Folder', async () => {
  const { panel, items } = await connectedPanel(
    [record('a', 'pinned', null, 0)],
    ['https://home.test/', 'https://new.test/'],
  );

  panel.send({
    type: 'item/from-tab',
    tabId: await tabOf('https://new.test/'),
    kind: 'pinned',
    parentId: 'a',
  });
  await settle();

  expect(items()).toHaveLength(1);
});

it('turns a Pinned Tab with an open live tab into an Unpinned Tab: the item goes, the tab stays', async () => {
  const { panel, items, unpinned } = await connectedPanel(
    [record('a', 'pinned', null, 0, 'https://a.test/')],
    ['https://home.test/'],
  );
  panel.send({ type: 'item/open', itemId: 'a' });
  await settle();
  expect(items()[0]?.live?.tabId).toBe(await tabOf('https://a.test/'));

  panel.send({ type: 'item/unpin', itemId: 'a' });
  await settle();

  expect(items()).toEqual([]);
  expect(unpinned()).toEqual(['https://home.test/', 'https://a.test/']);
  expect(await browser.tabs.query({ url: 'https://a.test/' })).toHaveLength(1);
});

it('opens the saved URL as an Unpinned Tab when the item is at rest', async () => {
  const { panel, items, unpinned, windowId } = await connectedPanel(
    [record('a', 'favorite', null, 0, 'https://saved.test/')],
    ['https://home.test/'],
  );

  panel.send({ type: 'item/unpin', itemId: 'a' });
  await settle();

  expect(items()).toEqual([]);
  expect(unpinned()).toEqual(['https://home.test/', 'https://saved.test/']);
  const [created] = await browser.tabs.query({ url: 'https://saved.test/' });
  expect(created?.windowId).toBe(windowId);
});

it('does not unpin a Folder', async () => {
  const { panel, items } = await connectedPanel(
    [record('work', 'folder', null, 0)],
    ['https://home.test/'],
  );

  panel.send({ type: 'item/unpin', itemId: 'work' });
  await settle();

  expect(ids(items())).toEqual(['work']);
});
