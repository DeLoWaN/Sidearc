import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';
import { PANEL_PORT, type PortMessage } from '../../shared/protocol';
import type { ItemRecord } from '../../shared/types';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0] as chrome.tabs.Tab;
const urlsOf = async (windowId: number) =>
  (await browser.tabs.query({ windowId })).map((tab) => tab.url);

function record(
  id: string,
  kind: ItemRecord['kind'],
  parentId: string | null,
  position: number,
  extra: Partial<ItemRecord> = {},
): ItemRecord {
  return {
    id,
    kind,
    title: id,
    url: kind === 'folder' ? '' : `https://${id}.test/`,
    parentId,
    position,
    collapsed: false,
    ...extra,
  };
}

/** Saves the items, opens windows with the URLs, and connects a panel in the first window. */
async function connectedPanel(records: ItemRecord[], urls: string[][]) {
  await browser.storage.local.set({ items: records });
  const windows: number[] = [];
  for (const group of urls) windows.push(await fakeChrome.openWindow(group));
  const panel = connectPanel(windows[0] as number);
  await settle();
  const send = async (command: Parameters<typeof panel.send>[0]) => {
    panel.send(command);
    await settle();
  };
  return {
    windows,
    panel,
    send,
    items: () => panel.latest()?.items ?? [],
    undo: () => panel.latest()?.undo,
    /** The stored items, as the worker keeps them. */
    stored: async () => (await browser.storage.local.get('items')).items as ItemRecord[],
  };
}

const sorted = (items: { id: string }[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));

it('offers nothing to undo before any action', async () => {
  const { undo, send } = await connectedPanel(
    [record('a', 'pinned', null, 0)],
    [['https://h.test/']],
  );
  expect(undo()).toBeNull();

  await send({ type: 'undo' });

  expect(undo()).toBeNull();
});

it('restores a deleted Pinned Tab exactly, and names the action', async () => {
  const records = [
    record('a', 'pinned', null, 0),
    record('b', 'pinned', null, 1, { title: 'Mail' }),
  ];
  const { send, undo, stored } = await connectedPanel(records, [['https://h.test/']]);

  await send({ type: 'item/delete', itemId: 'b' });
  expect((await stored()).map((item) => item.id)).toEqual(['a']);
  expect(undo()).toEqual({ label: 'Delete "Mail"' });

  await send({ type: 'undo' });

  expect(sorted(await stored())).toEqual(sorted(records));
  expect(undo()).toBeNull();
});

it('restores a deleted Folder with its whole subtree, and links an open tab again', async () => {
  const records = [
    record('f', 'folder', null, 0, { title: 'Work', collapsed: true }),
    record('g', 'folder', 'f', 0),
    record('p', 'pinned', 'g', 0, { url: 'https://p.test/' }),
    record('q', 'pinned', 'f', 1),
  ];
  const { send, items, stored } = await connectedPanel(records, [['https://h.test/']]);
  await send({ type: 'item/open', itemId: 'p' });
  const tabId = items().find((item) => item.id === 'p')?.live?.tabId;
  expect(tabId).toEqual(expect.any(Number));

  await send({ type: 'item/delete', itemId: 'f' });
  expect(items()).toEqual([]);
  expect(await urlsOf(1)).toContain('https://p.test/');

  await send({ type: 'undo' });

  expect(sorted(await stored())).toEqual(sorted(records));
  expect(items().find((item) => item.id === 'p')?.live?.tabId).toBe(tabId);
  expect(items().find((item) => item.id === 'f')?.collapsed).toBe(true);
});

it('undoes one action at a time, newest first', async () => {
  const { send, undo, items } = await connectedPanel(
    [record('a', 'pinned', null, 0), record('b', 'pinned', null, 1)],
    [['https://h.test/']],
  );

  await send({ type: 'item/rename', itemId: 'a', title: 'A2' });
  await send({ type: 'item/delete', itemId: 'b' });
  expect(undo()).toEqual({ label: 'Delete "b"' });

  await send({ type: 'undo' });
  expect(items().map((item) => item.title)).toEqual(['A2', 'b']);
  expect(undo()).toEqual({ label: 'Rename "a"' });

  await send({ type: 'undo' });
  expect(items().map((item) => item.title)).toEqual(['a', 'b']);
  expect(undo()).toBeNull();
});

it('undoes a move, a rename, a new Folder, a favorite conversion, a pin and an unpin', async () => {
  const { send, items, stored, windows } = await connectedPanel(
    [
      record('f', 'folder', null, 0),
      record('a', 'pinned', null, 1),
      record('b', 'pinned', null, 2),
    ],
    [['https://h.test/', 'https://new.test/']],
  );
  const original = await stored();
  const newTab = await tabOf('https://new.test/');

  await send({ type: 'item/move', itemId: 'a', parentId: 'f' });
  await send({ type: 'item/rename', itemId: 'b', title: 'B2' });
  await send({ type: 'folder/create', title: 'New', parentId: null });
  await send({ type: 'item/favorite', itemId: 'b' });
  await send({ type: 'item/from-tab', tabId: newTab.id as number, kind: 'pinned', parentId: null });
  await send({ type: 'item/unpin', itemId: 'a' });
  expect(items().length).not.toBe(original.length);

  for (let i = 0; i < 6; i++) await send({ type: 'undo' });

  expect(sorted(await stored())).toEqual(sorted(original));
  expect(await urlsOf(windows[0] as number)).toContain('https://new.test/');
});

it('keeps the 20 newest actions only', async () => {
  const { send, undo, items } = await connectedPanel(
    [record('a', 'pinned', null, 0)],
    [['https://h.test/']],
  );

  for (let i = 1; i <= 21; i++) await send({ type: 'item/rename', itemId: 'a', title: `T${i}` });
  for (let i = 0; i < 25; i++) await send({ type: 'undo' });

  // The 21st rename pushed the first one out: its undo (back to "a") is gone.
  expect(items()[0]?.title).toBe('T1');
  expect(undo()).toBeNull();
});

it('keeps nothing from a command that fails', async () => {
  const favorites = Array.from({ length: 12 }, (_, i) => record(`fav${i}`, 'favorite', null, i));
  const { undo, panel } = await connectedPanel(
    [...favorites, record('p', 'pinned', null, 0)],
    [['https://h.test/']],
  );
  const notices: string[] = [];
  const noticePort = fakeChrome.connect(PANEL_PORT);
  noticePort.onMessage.addListener((message) => {
    const received = message as PortMessage;
    if (received.type === 'notice') notices.push(received.message);
  });
  expect(panel.notices).toEqual([]);

  noticePort.postMessage({ type: 'item/favorite', itemId: 'p', windowId: 1 });
  await settle();

  expect(notices).toHaveLength(1);
  expect(undo()).toBeNull();
});

it('keeps nothing from a command that changes nothing', async () => {
  const { send, undo } = await connectedPanel(
    [record('a', 'pinned', null, 0)],
    [['https://h.test/']],
  );

  await send({ type: 'item/rename', itemId: 'a', title: '   ' });
  await send({ type: 'item/rename', itemId: 'a', title: 'a' });
  await send({ type: 'item/delete', itemId: 'missing' });
  await send({ type: 'folder/create', title: '', parentId: null });

  expect(undo()).toBeNull();
});

it('does not offer an Undo for Folder toggles, Clear, or the close of a live tab', async () => {
  const { send, undo, items } = await connectedPanel(
    [record('f', 'folder', null, 0), record('a', 'pinned', null, 1, { url: 'https://a.test/' })],
    [['https://h.test/', 'https://u.test/']],
  );

  await send({ type: 'folder/toggle', itemId: 'f' });
  expect(undo()).toBeNull();

  await send({ type: 'item/open', itemId: 'a' });
  await send({
    type: 'tab/close',
    tabId: items().find((item) => item.id === 'a')?.live?.tabId as number,
  });
  expect(undo()).toBeNull();

  await send({ type: 'tab/clear' });
  expect(undo()).toBeNull();
});

it('undoes after the service worker restarts', async () => {
  const { send, items } = await connectedPanel(
    [record('a', 'pinned', null, 0)],
    [['https://h.test/']],
  );
  await send({ type: 'item/delete', itemId: 'a' });

  stopWorker();
  await startWorker();
  const panel = connectPanel(1);
  await settle();
  expect(panel.latest()?.undo).toEqual({ label: 'Delete "a"' });
  panel.send({ type: 'undo' });
  await settle();

  expect(panel.latest()?.items.map((item) => item.id)).toEqual(['a']);
  expect(panel.latest()?.undo).toBeNull();
  expect(items()).toBeDefined();
});

it('forgets the Undo list when the browser restarts', async () => {
  const { send } = await connectedPanel([record('a', 'pinned', null, 0)], [['https://h.test/']]);
  await send({ type: 'item/delete', itemId: 'a' });

  await fakeChrome.restartBrowser();
  await startWorker();
  await fakeChrome.openWindow(['https://h.test/']);
  const panel = connectPanel(1);
  await settle();

  expect(panel.latest()?.undo).toBeNull();
});

it('reopens an Unpinned Tab that the panel closed, at its place and not active', async () => {
  const { send, undo, windows } = await connectedPanel(
    [],
    [['https://a.test/', 'https://b.test/', 'https://c.test/']],
  );
  const b = await tabOf('https://b.test/');

  await send({ type: 'tab/close', tabId: b.id as number });
  expect(undo()).toEqual({ label: 'Close tab "https://b.test/"' });
  expect(await urlsOf(windows[0] as number)).toEqual(['https://a.test/', 'https://c.test/']);

  await send({ type: 'undo' });

  expect(await urlsOf(windows[0] as number)).toEqual([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
  ]);
  expect((await tabOf('https://b.test/')).active).toBe(false);
  expect(undo()).toBeNull();
});

it('does not mark a reopened tab as not visited', async () => {
  const { send, panel } = await connectedPanel([], [['https://a.test/', 'https://b.test/']]);
  const b = await tabOf('https://b.test/');
  await send({ type: 'tab/close', tabId: b.id as number });

  await send({ type: 'undo' });

  const reopened = panel.latest()?.unpinnedTabs.find((tab) => tab.url === 'https://b.test/');
  expect(reopened?.unvisited).toBe(false);
});

it('puts the reopened tab back in its Tab group when the group still exists', async () => {
  const { send, windows } = await connectedPanel(
    [],
    [['https://a.test/', 'https://b.test/', 'https://c.test/']],
  );
  const a = await tabOf('https://a.test/');
  const b = await tabOf('https://b.test/');
  const groupId = await browser.tabs.group({ tabIds: [a.id as number, b.id as number] });

  await send({ type: 'tab/close', tabId: b.id as number });
  await send({ type: 'undo' });

  const reopened = await tabOf('https://b.test/');
  expect(reopened.groupId).toBe(groupId);
  expect(reopened.index).toBe(1);
  expect(await urlsOf(windows[0] as number)).toEqual([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
  ]);
});

it('reopens a tab in the window of the panel when its own window is gone', async () => {
  const { send, windows } = await connectedPanel([], [['https://a.test/'], ['https://x.test/']]);
  const x = await tabOf('https://x.test/');

  await send({ type: 'tab/close', tabId: x.id as number });
  expect((await browser.windows.getAll()).map((window) => window.id)).toEqual([windows[0]]);
  await send({ type: 'undo' });

  // The old window is gone, so the tab keeps its index in the window of the panel.
  expect(await urlsOf(windows[0] as number)).toEqual(['https://x.test/', 'https://a.test/']);
});

it('keeps a tab close and an item change in one list, newest first', async () => {
  const { send, undo, items } = await connectedPanel(
    [record('a', 'pinned', null, 0)],
    [['https://h.test/', 'https://u.test/']],
  );

  await send({ type: 'item/delete', itemId: 'a' });
  await send({ type: 'tab/close', tabId: (await tabOf('https://u.test/')).id as number });
  expect(undo()?.label).toContain('Close tab');

  await send({ type: 'undo' });
  expect(items()).toEqual([]);
  expect(undo()).toEqual({ label: 'Delete "a"' });
  await send({ type: 'undo' });
  expect(items().map((item) => item.id)).toEqual(['a']);
});
