import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';
import type { BackupCheckResult } from '../../shared/protocol';
import type { ItemView } from '../../shared/types';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0] as chrome.tabs.Tab;

/** Asks the worker like the options page does. */
const exportBackup = () =>
  browser.runtime.sendMessage({ rpc: 'backup/export', request: null }) as Promise<string>;

/** Pins the tab of this URL, as the user does with the shortcut. */
async function pin(url: string) {
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', await tabOf(url));
  await settle();
}

it('exports one versioned document with the items, the settings and the archive', async () => {
  const windowId = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  const panel = connectPanel(windowId);
  await pin('https://a.test/');
  panel.send({ type: 'folder/create', title: 'Work', parentId: null });
  await browser.runtime.sendMessage({
    rpc: 'settings/save',
    request: { density: 'compact', autoArchiveHours: 24 },
  });
  await settle();
  panel.send({ type: 'tab/clear' });
  await settle();

  const backup = JSON.parse(await exportBackup());

  expect(backup).toMatchObject({ format: 'sidearc-backup', version: 1 });
  expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
  expect(backup.items.map((item: { title: string }) => item.title).sort()).toEqual([
    'Work',
    expect.any(String),
  ]);
  expect(backup.settings).toMatchObject({ density: 'compact', autoArchiveHours: 24 });
  expect(backup.archive.map((entry: { url: string }) => entry.url)).toContain('https://b.test/');
});

const importBackup = (text: string) =>
  browser.runtime.sendMessage({
    rpc: 'backup/import',
    request: text,
  }) as Promise<BackupCheckResult>;
const inspectBackup = (text: string) =>
  browser.runtime.sendMessage({
    rpc: 'backup/inspect',
    request: text,
  }) as Promise<BackupCheckResult>;
const saveSettings = (request: unknown) =>
  browser.runtime.sendMessage({ rpc: 'settings/save', request });

/** What the user sees of an item, without the Chrome ids of its live tab. */
const look = (item: ItemView) => ({
  id: item.id,
  kind: item.kind,
  title: item.title,
  url: item.url,
  parentId: item.parentId,
  position: item.position,
  collapsed: item.collapsed,
  open: item.live !== undefined,
});

/** Makes a sidebar: a Favorite, a Folder with one Pinned Tab inside, a closed tab. */
async function buildSidebar() {
  const windowId = await fakeChrome.openWindow([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
  ]);
  const panel = connectPanel(windowId);
  await pin('https://a.test/');
  await pin('https://b.test/');
  panel.send({ type: 'folder/create', title: 'Work', parentId: null });
  await settle();
  const a = panel.latest()?.items.find((item) => item.url === 'https://a.test/') as ItemView;
  panel.send({ type: 'item/favorite', itemId: a.id });
  await settle();
  const folder = panel.latest()?.items.find((item) => item.kind === 'folder') as ItemView;
  const b = panel.latest()?.items.find((item) => item.url === 'https://b.test/') as ItemView;
  panel.send({ type: 'item/move', itemId: b.id, parentId: folder.id });
  panel.send({ type: 'folder/toggle', itemId: folder.id });
  await saveSettings({ density: 'spacious', gradientFrom: '#112233', autoArchiveHours: 48 });
  panel.send({ type: 'tab/clear' });
  await settle();
  return panel;
}

it('restores the same panel in a new browser profile where the same tabs are open', async () => {
  const before = (await buildSidebar()).latest();
  const text = await exportBackup();

  fakeChrome.reset();
  await startWorker();
  const windowId = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  const panel = connectPanel(windowId);
  await settle();
  expect(panel.latest()?.items).toEqual([]);

  expect(await importBackup(text)).toEqual({
    ok: true,
    summary: { favorites: 1, pinnedTabs: 1, folders: 1, archivedTabs: 1 },
  });
  await settle();

  const after = panel.latest();
  expect(after?.items.map(look)).toEqual(before?.items.map(look));
  expect(after?.settings).toEqual(before?.settings);
  expect(after?.archive).toEqual(before?.archive);
  expect(after?.items.every((item) => item.kind === 'folder' || item.live)).toBe(true);
});

it('replaces the current data when the same panel imports its own backup', async () => {
  const panel = await buildSidebar();
  const before = panel.latest();
  const text = await exportBackup();

  for (const item of before?.items ?? []) panel.send({ type: 'item/delete', itemId: item.id });
  await saveSettings({ density: 'compact' });
  await settle();
  expect(panel.latest()?.items).toEqual([]);

  await importBackup(text);
  await settle();

  expect(panel.latest()?.items.map(look)).toEqual(before?.items.map(look));
  expect(panel.latest()?.settings).toEqual(before?.settings);
});

it('imports a backup from before newTabsOnTop existed and gives the setting its default', async () => {
  await saveSettings({ newTabsOnTop: false });
  const doc = JSON.parse(await exportBackup());
  delete doc.settings.newTabsOnTop;

  const result = await importBackup(JSON.stringify(doc));

  expect(result).toMatchObject({ ok: true });
  expect(await browser.runtime.sendMessage({ rpc: 'settings/get', request: null })).toMatchObject({
    newTabsOnTop: true,
  });
});

it('leaves the items at rest when no open tab has their URL', async () => {
  await buildSidebar();
  const text = await exportBackup();

  fakeChrome.reset();
  await startWorker();
  const panel = connectPanel(await fakeChrome.openWindow(['https://other.test/']));
  await importBackup(text);
  await settle();

  expect(panel.latest()?.items.filter((item) => item.live)).toEqual([]);
  expect(panel.latest()?.items).toHaveLength(3);
});

it('puts an item at rest when the file gives its id another URL', async () => {
  const windowId = await fakeChrome.openWindow(['https://a.test/']);
  const panel = connectPanel(windowId);
  await pin('https://a.test/');
  const doc = JSON.parse(await exportBackup());
  doc.items[0].url = 'https://moved.test/';
  expect(panel.latest()?.items[0]?.live).toBeDefined();

  await importBackup(JSON.stringify(doc));
  await settle();

  expect(panel.latest()?.items.map((item) => [item.url, item.live])).toEqual([
    ['https://moved.test/', undefined],
  ]);
});

it('reports the counts of a backup file without changing anything', async () => {
  await buildSidebar();
  const text = await exportBackup();
  await saveSettings({ density: 'compact' });

  const result = await inspectBackup(text);

  expect(result).toMatchObject({ ok: true, summary: { favorites: 1, pinnedTabs: 1, folders: 1 } });
  expect(await browser.runtime.sendMessage({ rpc: 'settings/get', request: null })).toMatchObject({
    density: 'compact',
  });
});

// --- refused files

type Doc = Record<string, unknown> & { items: Record<string, unknown>[] };

const itemOf = (doc: Doc, title: string) =>
  doc.items.find((item) => item.title === title) as Record<string, unknown>;
const pathOf = (doc: Doc, title: string) => `items[${doc.items.indexOf(itemOf(doc, title))}]`;

/**
 * Each case changes a valid backup of the sidebar of `buildSidebar` and returns the error
 * that the worker must give.
 */
const refusals: [name: string, edit: (doc: Doc) => string][] = [
  [
    'a wrong format name',
    (doc) => {
      doc.format = 'arc-backup';
      return 'The file is not a Sidearc backup: format must be "sidearc-backup", got "arc-backup"';
    },
  ],
  [
    'an unknown version',
    (doc) => {
      doc.version = 2;
      return 'Unknown backup version 2: this Sidearc reads version 1';
    },
  ],
  [
    'an item with a kind that Sidearc does not know',
    (doc) => {
      itemOf(doc, 'Work').kind = 'bookmark';
      return `${pathOf(doc, 'Work')}.kind must be pinned, folder or favorite, got "bookmark"`;
    },
  ],
  [
    'an item with a wrong field',
    (doc) => {
      itemOf(doc, 'Work').collapsed = 'yes';
      return `${pathOf(doc, 'Work')}.collapsed must be true or false, got "yes"`;
    },
  ],
  [
    'a wrong setting',
    (doc) => {
      (doc.settings as Record<string, unknown>).density = 'huge';
      return 'settings: density must be compact, normal or spacious, got "huge"';
    },
  ],
  [
    'an archive entry with a wrong field',
    (doc) => {
      ((doc.archive as Record<string, unknown>[])[0] as Record<string, unknown>).closedAt =
        'yesterday';
      return 'archive[0].closedAt must be a number, got "yesterday"';
    },
  ],
  [
    'two items with the same id',
    (doc) => {
      const [first, second] = doc.items as [Record<string, unknown>, Record<string, unknown>];
      second.id = first.id;
      return `items[1].id ${JSON.stringify(first.id)} is used twice`;
    },
  ],
  [
    'an item whose parent does not exist',
    (doc) => {
      itemOf(doc, 'Work').parentId = 'missing';
      return `${pathOf(doc, 'Work')}.parentId "missing" is not the id of an item`;
    },
  ],
  [
    'an item whose parent is a Pinned Tab',
    (doc) => {
      const pinned = doc.items.find((item) => item.kind === 'pinned');
      itemOf(doc, 'Work').parentId = pinned?.id;
      return `${pathOf(doc, 'Work')}.parentId ${JSON.stringify(pinned?.id)} is not the id of a Folder`;
    },
  ],
  [
    'a Folder inside itself',
    (doc) => {
      itemOf(doc, 'Work').parentId = itemOf(doc, 'Work').id;
      return `${pathOf(doc, 'Work')} is inside itself: its parents make a loop`;
    },
  ],
  [
    'two Folders inside each other',
    (doc) => {
      const work = itemOf(doc, 'Work');
      doc.items.push({ ...work, id: 'play', title: 'Play', parentId: work.id });
      work.parentId = 'play';
      return `${pathOf(doc, 'Work')} is inside itself: its parents make a loop`;
    },
  ],
  [
    'a Favorite inside a Folder',
    (doc) => {
      const favorite = doc.items.find((item) => item.kind === 'favorite') as Record<
        string,
        unknown
      >;
      favorite.parentId = itemOf(doc, 'Work').id;
      return `${pathOf(doc, favorite.title as string)}.parentId must be null for a Favorite, got ${JSON.stringify(favorite.parentId)}`;
    },
  ],
  [
    'more than 12 Favorites',
    (doc) => {
      for (let n = 0; n < 12; n++)
        doc.items.push({
          id: `fav-${n}`,
          kind: 'favorite',
          title: `Fav ${n}`,
          url: `https://fav-${n}.test/`,
          parentId: null,
          position: n,
          collapsed: false,
        });
      return 'items holds 13 Favorites, but a profile has 12 at most';
    },
  ],
];

it.each([
  ['text that is not JSON', 'not json {', 'The file is not valid JSON'],
  ['a JSON list', '[]', 'The file is not a Sidearc backup: it must hold an object'],
])('refuses %s with a precise error', async (_name, text, error) => {
  expect(await inspectBackup(text)).toEqual({ ok: false, error });
  expect(await importBackup(text)).toEqual({ ok: false, error });
});

it.each(refusals)('refuses %s with a precise error and changes nothing', async (_name, edit) => {
  const panel = await buildSidebar();
  const doc = JSON.parse(await exportBackup()) as Doc;
  const error = edit(doc);
  const text = JSON.stringify(doc);
  const before = panel.latest();

  expect(await inspectBackup(text)).toEqual({ ok: false, error });
  expect(await importBackup(text)).toEqual({ ok: false, error });
  await settle();

  expect(panel.latest()).toEqual(before);
});
