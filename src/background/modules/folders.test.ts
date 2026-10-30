import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';
import type { ItemView } from '../../shared/types';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

it('refuses to add an item under a parent that is not a Folder, with a named error', async () => {
  const { addItem, NotAFolderError } = await import('./item-store');
  const pinned = await addItem({ kind: 'pinned', title: 'A', url: 'https://a.test/' });

  await expect(
    addItem({ kind: 'pinned', title: 'B', url: 'https://b.test/', parentId: pinned.id }),
  ).rejects.toThrow(NotAFolderError);
  await expect(
    addItem({ kind: 'pinned', title: 'B', url: 'https://b.test/', parentId: 'missing' }),
  ).rejects.toThrow('Not a Folder: missing');
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0] as chrome.tabs.Tab;

async function connectedPanel(urls: string[][]) {
  const windows: number[] = [];
  for (const group of urls) windows.push(await fakeChrome.openWindow(group));
  const panel = connectPanel(windows[0] as number);
  await settle();
  const items = () => panel.latest()?.items ?? [];
  const byTitle = (title: string) => items().find((item) => item.title === title) as ItemView;
  return {
    windows,
    panel,
    items,
    byTitle,
    unpinned: () => panel.latest()?.unpinnedTabs.map((tab) => tab.url),
    /** Creates a Folder and waits for the next state. */
    async createFolder(title: string, parentId: string | null = null) {
      panel.send({ type: 'folder/create', title, parentId });
      await settle();
    },
    /** Moves an item and waits for the next state. */
    async move(item: ItemView, parentId: string | null) {
      panel.send({ type: 'item/move', itemId: item.id, parentId });
      await settle();
    },
  };
}

/** Presses the "pin current tab" shortcut while this tab is the current one. */
async function pin(tab: chrome.tabs.Tab) {
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', tab);
  await settle();
}

it('creates a Folder at the root, open and without a live tab', async () => {
  const { createFolder, items } = await connectedPanel([['https://a.test/']]);

  await createFolder('Work');

  expect(items()).toHaveLength(1);
  expect(items()[0]).toMatchObject({
    kind: 'folder',
    title: 'Work',
    parentId: null,
    collapsed: false,
  });
  expect(items()[0]?.id).toEqual(expect.any(String));
  expect(items()[0]?.live).toBeUndefined();
});

it('creates Folders inside Folders, each after the earlier ones of its parent', async () => {
  const { createFolder, items, byTitle } = await connectedPanel([['https://a.test/']]);

  await createFolder('Work');
  await createFolder('Home');
  await createFolder('Projects', byTitle('Work').id);
  await createFolder('Archive', byTitle('Work').id);

  expect(items().map((item) => [item.title, item.parentId, item.position])).toEqual([
    ['Work', null, 0],
    ['Projects', byTitle('Work').id, 0],
    ['Home', null, 1],
    ['Archive', byTitle('Work').id, 1],
  ]);
});

it('ignores a Folder with a blank name, and a parent that is not a Folder', async () => {
  const { createFolder, items } = await connectedPanel([['https://a.test/']]);
  await pin(await tabOf('https://a.test/'));
  const pinnedId = items()[0]?.id as string;

  await createFolder('   ');
  await createFolder('Lost', pinnedId);
  await createFolder('Orphan', 'no-such-folder');

  expect(items().map((item) => item.kind)).toEqual(['pinned']);
});

it('collapses and expands a Folder, and remembers it after Chrome restarted', async () => {
  const { panel, createFolder, items, byTitle } = await connectedPanel([['https://a.test/']]);
  await createFolder('Work');
  await createFolder('Home');

  panel.send({ type: 'folder/toggle', itemId: byTitle('Work').id });
  await settle();
  expect(items().map((item) => [item.title, item.collapsed])).toEqual([
    ['Work', true],
    ['Home', false],
  ]);

  // Chrome quits: tabs and session storage are gone, local storage stays.
  const stored = await browser.storage.local.get(null);
  stopWorker();
  fakeChrome.reset();
  await browser.storage.local.set(stored);
  const window = await fakeChrome.openWindow(['https://a.test/']);
  await startWorker();
  const reopened = connectPanel(window);
  await settle();
  expect(reopened.latest()?.items.map((item) => [item.title, item.collapsed])).toEqual([
    ['Work', true],
    ['Home', false],
  ]);

  const itemId = reopened.latest()?.items[0]?.id as string;
  reopened.send({ type: 'folder/toggle', itemId });
  await settle();
  expect(reopened.latest()?.items[0]?.collapsed).toBe(false);
});

it('ignores a toggle of an item that is not a Folder', async () => {
  const { panel, items } = await connectedPanel([['https://a.test/']]);
  await pin(await tabOf('https://a.test/'));

  panel.send({ type: 'folder/toggle', itemId: items()[0]?.id as string });
  await settle();

  expect(items()[0]?.collapsed).toBe(false);
});

it('moves a Pinned Tab into a Folder and back to the root, and keeps its live tab', async () => {
  const { createFolder, move, items, byTitle, unpinned } = await connectedPanel([
    ['https://a.test/', 'https://b.test/'],
  ]);
  await pin(await tabOf('https://a.test/'));
  await createFolder('Work');
  const liveTab = items()[0]?.live?.tabId;
  const pinned = items()[0] as ItemView;

  await move(pinned, byTitle('Work').id);
  expect(items().find((item) => item.kind === 'pinned')).toMatchObject({
    parentId: byTitle('Work').id,
    live: { tabId: liveTab },
  });
  expect(unpinned()).toEqual(['https://b.test/']);

  await move(pinned, null);
  expect(items().find((item) => item.kind === 'pinned')).toMatchObject({
    parentId: null,
    live: { tabId: liveTab },
  });
});

it('puts a moved item at the end of its new parent', async () => {
  const { createFolder, move, items, byTitle } = await connectedPanel([['https://a.test/']]);
  await createFolder('Work');
  await createFolder('First', byTitle('Work').id);
  await createFolder('Second');

  await move(byTitle('Second'), byTitle('Work').id);

  const inWork = items().filter((item) => item.parentId === byTitle('Work').id);
  expect(inWork.sort((a, b) => a.position - b.position).map((item) => item.title)).toEqual([
    'First',
    'Second',
  ]);
});

it('moves a Folder with its content into another Folder', async () => {
  const { createFolder, move, items, byTitle } = await connectedPanel([['https://a.test/']]);
  await createFolder('Work');
  await createFolder('Home');
  await createFolder('Projects', byTitle('Work').id);

  await move(byTitle('Work'), byTitle('Home').id);

  expect(byTitle('Work').parentId).toBe(byTitle('Home').id);
  expect(byTitle('Projects').parentId).toBe(byTitle('Work').id);
  expect(items()).toHaveLength(3);
});

it('refuses to move a Folder inside itself or inside its own content', async () => {
  const { createFolder, move, byTitle } = await connectedPanel([['https://a.test/']]);
  await createFolder('Work');
  await createFolder('Projects', byTitle('Work').id);
  await createFolder('Deep', byTitle('Projects').id);

  await move(byTitle('Work'), byTitle('Work').id);
  await move(byTitle('Work'), byTitle('Projects').id);
  await move(byTitle('Work'), byTitle('Deep').id);

  expect(byTitle('Work').parentId).toBeNull();
  expect(byTitle('Projects').parentId).toBe(byTitle('Work').id);
  expect(byTitle('Deep').parentId).toBe(byTitle('Projects').id);
});

it('refuses to move an item into something that is not a Folder', async () => {
  const { createFolder, move, items, byTitle } = await connectedPanel([['https://a.test/']]);
  await pin(await tabOf('https://a.test/'));
  await createFolder('Work');
  const pinned = items().find((item) => item.kind === 'pinned') as ItemView;

  await move(byTitle('Work'), pinned.id);
  await move(byTitle('Work'), 'no-such-folder');

  expect(byTitle('Work').parentId).toBeNull();
});

it('deletes a Folder with all its content, and leaves the live tabs open as Unpinned Tabs', async () => {
  const { panel, createFolder, move, items, byTitle, unpinned } = await connectedPanel([
    ['https://a.test/', 'https://b.test/'],
  ]);
  await pin(await tabOf('https://a.test/'));
  await createFolder('Work');
  await createFolder('Home');
  await createFolder('Projects', byTitle('Work').id);
  await move(items().find((item) => item.kind === 'pinned') as ItemView, byTitle('Projects').id);

  panel.send({ type: 'item/delete', itemId: byTitle('Work').id });
  await settle();

  expect(items().map((item) => item.title)).toEqual(['Home']);
  expect(unpinned()).toEqual(['https://a.test/', 'https://b.test/']);
  const stored = (await browser.storage.local.get('items')).items as unknown[];
  expect(stored).toHaveLength(1);
});

it('renames a Folder', async () => {
  const { panel, createFolder, items, byTitle } = await connectedPanel([['https://a.test/']]);
  await createFolder('Work');

  panel.send({ type: 'item/rename', itemId: byTitle('Work').id, title: ' Job ' });
  await settle();

  expect(items().map((item) => item.title)).toEqual(['Job']);
});
