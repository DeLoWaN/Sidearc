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
const available = () =>
  browser.runtime.sendMessage({ rpc: 'arc-import/available', request: null }) as Promise<
    ArcImportRpc['arc-import/available']['response']
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

it('offers the import while Sidearc has no items', async () => {
  expect(await available()).toBe(true);
});

it('stops offering the import once Sidearc has items', async () => {
  await browser.storage.local.set({ items: [savedItem] });

  expect(await available()).toBe(false);
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
  expect(await available()).toBe(false);
});

it('shows the imported items in the panels', async () => {
  const panel = connectPanel(1);
  await settle();

  await importSpace(fixture, ALPHA);
  await settle();

  expect(panel.latest()?.items.map((item) => item.title)).toContain('Example Docs');
  expect(panel.latest()?.items.filter((item) => item.kind === 'favorite')).toHaveLength(3);
});

it('refuses to import when Sidearc has items, and changes nothing', async () => {
  await browser.storage.local.set({ items: [savedItem] });

  const result = await importSpace(fixture, ALPHA);

  expect(result).toEqual({
    ok: false,
    error: 'Sidearc already has items. The Arc import runs only on an empty Sidearc.',
  });
  expect(await getItems()).toEqual([savedItem]);
});

it('refuses a file that is not an Arc sidebar, and stores nothing', async () => {
  const result = await importSpace('{"hello":"world"}', ALPHA);

  expect(result).toEqual({
    ok: false,
    error: 'This is not an Arc sidebar file: "sidebar.containers" is missing.',
  });
  expect(await getItems()).toEqual([]);
});

it('refuses a space that is not in the file, and stores nothing', async () => {
  const result = await importSpace(fixture, 'missing-space');

  expect(result).toMatchObject({ ok: false });
  expect(await getItems()).toEqual([]);
});

it('refuses a second import', async () => {
  await importSpace(fixture, ALPHA);

  const second = await importSpace(fixture, ALPHA);

  expect(second).toMatchObject({ ok: false });
  expect(await getItems()).toHaveLength(17);
});

it('keeps the imported items when Chrome stops and restarts the worker', async () => {
  await importSpace(fixture, ALPHA);
  stopWorker();
  await startWorker();

  expect(await available()).toBe(false);
  expect(await getItems()).toHaveLength(17);
});
