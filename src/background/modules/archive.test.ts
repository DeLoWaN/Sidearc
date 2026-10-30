import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';

const START = new Date('2026-03-01T10:00:00Z');

beforeEach(async () => {
  // Only Date is fake: `settle` needs the real setTimeout.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  fakeChrome.reset();
  await startWorker();
});

afterEach(() => vi.useRealTimers());

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0] as chrome.tabs.Tab;
const urlsOf = async (windowId: number) =>
  (await browser.tabs.query({ windowId })).map((tab) => tab.url);

/** Opens windows and connects a panel in the first one. */
async function connectedPanel(urls: string[][]) {
  const windows: number[] = [];
  for (const group of urls) windows.push(await fakeChrome.openWindow(group));
  const panel = connectPanel(windows[0] as number);
  await settle();
  return { windows, panel, archive: () => panel.latest()?.archive ?? [] };
}

/** Pins the tab of this URL: it gets an item and becomes its live tab. */
async function pin(url: string) {
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', await tabOf(url));
  await settle();
}

it('Clear closes every Unpinned Tab and lists it in View Archive with title, icon and closing time', async () => {
  const { panel, archive } = await connectedPanel([
    ['https://a.test/', 'https://b.test/'],
    ['https://c.test/'],
  ]);
  await fakeChrome.patchTab((await tabOf('https://a.test/')).id as number, {
    title: 'Site A',
    favIconUrl: 'https://a.test/icon.png',
  });
  await settle();

  panel.send({ type: 'tab/clear' });
  await settle();

  expect(panel.latest()?.unpinnedTabs.map((tab) => tab.url)).not.toContain('https://a.test/');
  expect(archive().map((entry) => entry.url)).toEqual(
    expect.arrayContaining(['https://a.test/', 'https://b.test/', 'https://c.test/']),
  );
  expect(archive().find((entry) => entry.url === 'https://a.test/')).toMatchObject({
    title: 'Site A',
    iconUrl: 'https://a.test/icon.png',
    closedAt: START.getTime(),
  });
});

it('Clear leaves the live tab of a Pinned Tab open', async () => {
  const { panel, archive } = await connectedPanel([['https://pinned.test/', 'https://b.test/']]);
  await pin('https://pinned.test/');

  panel.send({ type: 'tab/clear' });
  await settle();

  expect((await browser.tabs.query({})).map((tab) => tab.url)).toContain('https://pinned.test/');
  expect(archive().map((entry) => entry.url)).toEqual(['https://b.test/']);
});

it('Clear closes a tab inside a Tab group', async () => {
  const { panel, archive } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await browser.tabs.group({ tabIds: [(await tabOf('https://a.test/')).id as number] });

  panel.send({ type: 'tab/clear' });
  await settle();

  expect(archive().map((entry) => entry.url)).toContain('https://a.test/');
  expect(await browser.tabs.query({ url: 'https://a.test/' })).toEqual([]);
});

it('Clear closes a chrome:// tab but does not archive it', async () => {
  const { panel, archive } = await connectedPanel([['chrome://settings/', 'https://a.test/']]);

  panel.send({ type: 'tab/clear' });
  await settle();

  expect(await browser.tabs.query({ url: 'chrome://settings/' })).toEqual([]);
  expect(archive().map((entry) => entry.url)).toEqual(['https://a.test/']);
});

it('Clear keeps a window open with one blank tab when it held only Unpinned Tabs', async () => {
  const { windows, panel } = await connectedPanel([['https://a.test/'], ['https://b.test/']]);

  panel.send({ type: 'tab/clear' });
  await settle();

  for (const windowId of windows) expect(await urlsOf(windowId)).toEqual(['chrome://newtab/']);
});

it('Clear keeps the window of a live tab as it is', async () => {
  const { windows, panel } = await connectedPanel([['https://pinned.test/', 'https://a.test/']]);
  await pin('https://pinned.test/');

  panel.send({ type: 'tab/clear' });
  await settle();

  expect(await urlsOf(windows[0] as number)).toEqual(['https://pinned.test/']);
});

/** Clears two windows, so that the archive holds the tabs of `urls`. */
async function archivedTabs(urls: string[]) {
  const { windows, panel } = await connectedPanel([urls, ['https://pinned.test/']]);
  await pin('https://pinned.test/');
  panel.send({ type: 'tab/clear' });
  await settle();
  return { windows, panel };
}

it('lists the latest closed tab first', async () => {
  const { windows, panel, archive } = await connectedPanel([['https://a.test/']]);
  panel.send({ type: 'tab/clear' });
  await settle();
  vi.setSystemTime(new Date(START.getTime() + 60_000));
  await browser.tabs.create({ windowId: windows[0], url: 'https://b.test/' });
  panel.send({ type: 'tab/clear' });
  await settle();

  expect(archive().map((entry) => entry.url)).toEqual(['https://b.test/', 'https://a.test/']);
});

it('does not archive a tab that the user closes by hand', async () => {
  const { panel, archive } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  panel.send({ type: 'tab/close', tabId: (await tabOf('https://a.test/')).id as number });
  await settle();

  expect(archive()).toEqual([]);
});

it('keeps the closed tabs after the service worker restarted', async () => {
  const { windows } = await archivedTabs(['https://a.test/', 'https://b.test/']);
  stopWorker();
  await startWorker();

  const reconnected = connectPanel(windows[1] as number);
  await settle();

  expect(reconnected.latest()?.archive.map((entry) => entry.url)).toEqual([
    'https://a.test/',
    'https://b.test/',
  ]);
});

it('reopens an archived tab as an Unpinned Tab in the window of the panel, and removes its entry', async () => {
  const { windows, panel } = await archivedTabs(['https://a.test/', 'https://b.test/']);
  const entry = panel.latest()?.archive.find((candidate) => candidate.url === 'https://b.test/');

  const second = connectPanel(windows[1] as number);
  await settle();
  second.send({ type: 'archive/reopen', entryId: entry?.id as string });
  await settle();

  const reopened = await tabOf('https://b.test/');
  expect(reopened.windowId).toBe(windows[1]);
  expect(reopened.active).toBe(true);
  expect(second.latest()?.unpinnedTabs.map((tab) => tab.url)).toContain('https://b.test/');
  expect(second.latest()?.archive.map((candidate) => candidate.url)).toEqual(['https://a.test/']);
  expect(panel.latest()?.archive).toEqual(second.latest()?.archive);
});

it('opens one tab when the user clicks an archived tab twice', async () => {
  const { panel } = await archivedTabs(['https://a.test/', 'https://b.test/']);
  const entry = panel.latest()?.archive.find((candidate) => candidate.url === 'https://a.test/');

  panel.send({ type: 'archive/reopen', entryId: entry?.id as string });
  panel.send({ type: 'archive/reopen', entryId: entry?.id as string });
  await settle();

  expect(await browser.tabs.query({ url: 'https://a.test/' })).toHaveLength(1);
});

it('ignores an entry that does not exist', async () => {
  const { panel } = await archivedTabs(['https://a.test/']);
  const before = (await browser.tabs.query({})).length;

  panel.send({ type: 'archive/reopen', entryId: 'unknown' });
  await settle();

  expect(await browser.tabs.query({})).toHaveLength(before);
});

it('drops the entries older than 30 days', async () => {
  const { windows } = await archivedTabs(['https://a.test/']);
  const urlsAt = async (days: number) => {
    vi.setSystemTime(new Date(START.getTime() + days * 24 * 3600 * 1000));
    const panel = connectPanel(windows[1] as number);
    await settle();
    return panel.latest()?.archive.map((entry) => entry.url);
  };

  expect(await urlsAt(29)).toEqual(['https://a.test/']);
  expect(await urlsAt(31)).toEqual([]);
});

it('forgets an old entry for good when a new tab is archived', async () => {
  const { windows, panel } = await archivedTabs(['https://a.test/']);
  vi.setSystemTime(new Date(START.getTime() + 31 * 24 * 3600 * 1000));
  await browser.tabs.create({ windowId: windows[0], url: 'https://new.test/' });
  panel.send({ type: 'tab/clear' });
  await settle();

  vi.setSystemTime(START);
  const stored = (await browser.storage.local.get('archive')).archive as { url: string }[];
  expect(stored.map((entry) => entry.url)).toEqual(['https://new.test/']);
});
