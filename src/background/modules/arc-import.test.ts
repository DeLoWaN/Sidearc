import { readFileSync } from 'node:fs';
import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';
import type { ArcImportRpc } from '../../shared/protocol';
import { getItems } from './item-store';

const fixture = readFileSync('tests/fixtures/arc/StorableSidebar.trimmed.json', 'utf8');
const ALPHA = 'thebrowser.company.defaultPersonalSpaceID';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

/** Asks the worker like the options page does. */
const status = () =>
  browser.runtime.sendMessage({ rpc: 'arc-import/status', request: null }) as Promise<
    ArcImportRpc['arc-import/status']['response']
  >;
const importSpace = (text: string, spaceId: string) =>
  browser.runtime.sendMessage({
    rpc: 'arc-import/run',
    request: { text, spaceId },
  }) as Promise<ArcImportRpc['arc-import/run']['response']>;

const savedItem = {
  id: 'saved-1',
  kind: 'pinned',
  title: 'Saved',
  url: 'https://saved.test/',
  parentId: null,
  position: 0,
  collapsed: false,
};

/** What the user sees of the items: no ids, because each import makes new ones. */
const shape = (items: { kind: string; title: string; url: string; position: number }[]) =>
  items
    .map(({ kind, title, url, position }) => ({ kind, title, url, position }))
    .sort((a, b) => `${a.kind}${a.title}`.localeCompare(`${b.kind}${b.title}`));

it('counts the items of Sidearc', async () => {
  expect(await status()).toEqual({ itemCount: 0 });

  await browser.storage.local.set({ items: [savedItem] });

  expect(await status()).toEqual({ itemCount: 1 });
});

it('stores every item of the space at once and answers with the report', async () => {
  const result = await importSpace(fixture, ALPHA);

  expect(result).toEqual({
    ok: true,
    report: { favorites: 3, pinnedTabs: 9, folders: 5, favoritesIgnored: 0, skipped: 3 },
  });
  const items = await getItems();
  expect(items).toHaveLength(17);
  expect(items.filter((item) => item.kind === 'favorite').map((item) => item.title)).toEqual([
    'Mail',
    'Chat',
    'Calendar',
  ]);
  expect(await status()).toEqual({ itemCount: 17 });
});

it('shows the imported items in the panels', async () => {
  const panel = connectPanel(1);
  await settle();

  await importSpace(fixture, ALPHA);
  await settle();

  expect(panel.latest()?.items.map((item) => item.title)).toContain('Example Docs');
  expect(panel.latest()?.items.filter((item) => item.kind === 'favorite')).toHaveLength(3);
});

it('replaces the items of Sidearc with the space, as an import into an empty Sidearc gives them', async () => {
  await importSpace(fixture, ALPHA);
  const expected = shape(await getItems());
  await browser.storage.local.set({ items: [savedItem] });

  const result = await importSpace(fixture, ALPHA);

  expect(result).toMatchObject({ ok: true });
  const items = await getItems();
  expect(items.map((item) => item.id)).not.toContain('saved-1');
  expect(shape(items)).toEqual(expected);
});

it('keeps the settings and View Archive when it replaces the items', async () => {
  const archive = [{ id: 'a1', url: 'https://old.test/', title: 'Old', iconUrl: '', closedAt: 1 }];
  await browser.storage.local.set({
    items: [savedItem],
    archive,
    settings: { autoArchiveHours: 72 },
  });

  await importSpace(fixture, ALPHA);

  const stored = await browser.storage.local.get(['archive', 'settings']);
  expect(stored.archive).toEqual(archive);
  expect(stored.settings).toEqual({ autoArchiveHours: 72 });
});

it('refuses a file that is not an Arc sidebar, and keeps the items', async () => {
  await browser.storage.local.set({ items: [savedItem] });

  const result = await importSpace('{"hello":"world"}', ALPHA);

  expect(result).toEqual({
    ok: false,
    error: 'This is not an Arc sidebar file: "sidebar.containers" is missing.',
  });
  expect(await getItems()).toEqual([savedItem]);
});

it('refuses a space that is not in the file, and keeps the items', async () => {
  await browser.storage.local.set({ items: [savedItem] });

  const result = await importSpace(fixture, 'missing-space');

  expect(result).toMatchObject({ ok: false });
  expect(await getItems()).toEqual([savedItem]);
});

it('puts the old live tabs at rest, then links the open tabs that show the new URLs', async () => {
  await browser.storage.local.set({
    items: [{ ...savedItem, url: 'https://elsewhere.test/' }],
  });
  const windowId = await fakeChrome.openWindow([
    'https://docs.example.test/',
    'https://elsewhere.test/',
  ]);
  const [, elsewhere] = await browser.tabs.query({ windowId });
  await browser.storage.session.set({ liveTabs: { 'saved-1': elsewhere?.id } });
  const panel = connectPanel(windowId);
  await settle();
  expect(panel.latest()?.items[0]?.live).toBeDefined();

  await importSpace(fixture, ALPHA);
  await settle();

  const items = panel.latest()?.items ?? [];
  expect(items.map((item) => item.id)).not.toContain('saved-1');
  expect(items.filter((item) => item.live).map((item) => item.url)).toEqual([
    'https://docs.example.test/',
  ]);
});

it('lets the user undo the replacement with the Undo button', async () => {
  await browser.storage.local.set({ items: [savedItem] });
  const panel = connectPanel(1);
  await settle();

  await importSpace(fixture, ALPHA);
  await settle();
  expect(panel.latest()?.undo).toEqual({ label: 'Import from Arc' });
  panel.send({ type: 'undo' });
  await settle();

  expect(await getItems()).toEqual([savedItem]);
  expect(panel.latest()?.undo).toBeNull();
});

it('records nothing to undo when the file is refused', async () => {
  const panel = connectPanel(1);
  await settle();

  await importSpace('{"hello":"world"}', ALPHA);
  await settle();

  expect(panel.latest()?.undo).toBeNull();
});

it('keeps the imported items when Chrome stops and restarts the worker', async () => {
  await importSpace(fixture, ALPHA);
  stopWorker();
  await startWorker();

  expect(await status()).toEqual({ itemCount: 17 });
  expect(await getItems()).toHaveLength(17);
});
