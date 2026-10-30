import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';

const START = new Date('2026-03-01T10:00:00Z');
const HOUR = 3600 * 1000;

beforeEach(async () => {
  // Only Date is fake: `settle` needs the real setTimeout.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  fakeChrome.reset();
  await startWorker();
  await settle();
});

afterEach(() => vi.useRealTimers());

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0] as chrome.tabs.Tab;
const openUrls = async () => (await browser.tabs.query({})).map((tab) => tab.url);

/** Makes the tab of this URL old: nobody viewed it for this long. */
async function idleFor(url: string, ms: number) {
  fakeChrome.setLastAccessed((await tabOf(url)).id as number, Date.now() - ms);
}

/** Fires the Auto Archive alarm, like Chrome does every few minutes. */
async function tick() {
  await (browser.alarms.onAlarm as unknown as { trigger(alarm: object): Promise<void> }).trigger({
    name: 'auto-archive',
    scheduledTime: Date.now(),
  });
  await settle();
}

/** A window with a tab on screen (the last URL) and the other tabs behind it. */
async function windowOf(...urls: string[]) {
  return fakeChrome.openWindow([...urls, 'https://on-screen.test/']);
}

const archivedUrls = async () => {
  const panel = connectPanel((await browser.windows.getAll())[0]?.id as number);
  await settle();
  return panel.latest()?.archive.map((entry) => entry.url);
};

it('runs an alarm every few minutes from the start of the worker', async () => {
  const alarms = await browser.alarms.getAll();
  expect(alarms.map((alarm) => [alarm.name, alarm.periodInMinutes])).toEqual([['auto-archive', 5]]);
});

it('creates the alarm again when Chrome lost it', async () => {
  await browser.alarms.clearAll();
  stopWorker();
  await startWorker();
  expect((await browser.alarms.getAll()).map((alarm) => alarm.name)).toEqual(['auto-archive']);
});

it('does not delay the alarm when the worker starts again', async () => {
  const [before] = await browser.alarms.getAll();
  vi.setSystemTime(new Date(START.getTime() + 60_000));
  stopWorker();
  await startWorker();
  const [after] = await browser.alarms.getAll();
  expect(after?.scheduledTime).toBe(before?.scheduledTime);
});

it('closes an Unpinned Tab that nobody viewed for 12 hours and puts it in View Archive', async () => {
  await windowOf('https://old.test/', 'https://recent.test/');
  await idleFor('https://old.test/', 12 * HOUR + 1);
  await idleFor('https://recent.test/', 11 * HOUR);

  await tick();

  expect(await openUrls()).toEqual(['https://recent.test/', 'https://on-screen.test/']);
  expect(await archivedUrls()).toEqual(['https://old.test/']);
});

it('does nothing before the alarm fires', async () => {
  await windowOf('https://old.test/');
  await idleFor('https://old.test/', 30 * HOUR);
  await settle();
  expect(await openUrls()).toContain('https://old.test/');
});

it('uses the stored delay', async () => {
  await browser.storage.local.set({ settings: { autoArchiveHours: 1 } });
  await windowOf('https://old.test/', 'https://recent.test/');
  await idleFor('https://old.test/', 61 * 60 * 1000);
  await idleFor('https://recent.test/', 59 * 60 * 1000);

  await tick();

  expect(await openUrls()).toEqual(['https://recent.test/', 'https://on-screen.test/']);
});

it('follows a delay change from the options page at the next alarm', async () => {
  await windowOf('https://old.test/');
  await idleFor('https://old.test/', 20 * HOUR);
  const save = (autoArchiveHours: number) =>
    browser.runtime.sendMessage({ rpc: 'settings/save', request: { autoArchiveHours } });

  await save(48);
  await tick();
  expect(await openUrls()).toContain('https://old.test/');

  await save(6);
  await tick();
  expect(await openUrls()).toEqual(['https://on-screen.test/']);
});

it('keeps 12 hours as the delay while the stored settings hold no delay', async () => {
  await browser.storage.local.set({ settings: {} });
  await windowOf('https://old.test/');
  await idleFor('https://old.test/', 11 * HOUR);

  await tick();

  expect(await openUrls()).toContain('https://old.test/');
});

it('never closes the live tab of a Pinned Tab', async () => {
  await windowOf('https://pinned.test/', 'https://old.test/');
  await fakeChrome.events.commands.onCommand.trigger(
    'pin-current-tab',
    await tabOf('https://pinned.test/'),
  );
  await settle();
  await idleFor('https://pinned.test/', 30 * HOUR);
  await idleFor('https://old.test/', 30 * HOUR);

  await tick();

  expect(await openUrls()).toEqual(['https://pinned.test/', 'https://on-screen.test/']);
});

it('never closes the tab on screen in any window', async () => {
  await windowOf('https://old.test/');
  await windowOf();
  for (const tab of await browser.tabs.query({}))
    fakeChrome.setLastAccessed(tab.id as number, START.getTime() - 30 * HOUR);

  await tick();

  expect(await openUrls()).toEqual(['https://on-screen.test/', 'https://on-screen.test/']);
});

it('never closes a tab that plays sound', async () => {
  await windowOf('https://music.test/', 'https://old.test/');
  await fakeChrome.patchTab((await tabOf('https://music.test/')).id as number, { audible: true });
  await idleFor('https://music.test/', 30 * HOUR);
  await idleFor('https://old.test/', 30 * HOUR);

  await tick();

  expect(await openUrls()).toEqual(['https://music.test/', 'https://on-screen.test/']);
});

it('closes a tab inside a Tab group like any other tab', async () => {
  await windowOf('https://grouped.test/', 'https://other.test/');
  await browser.tabs.group({ tabIds: [(await tabOf('https://grouped.test/')).id as number] });
  await idleFor('https://grouped.test/', 13 * HOUR);

  await tick();

  expect(await openUrls()).toEqual(['https://other.test/', 'https://on-screen.test/']);
  expect(await archivedUrls()).toEqual(['https://grouped.test/']);
});

it('closes a chrome:// tab that nobody viewed and archives it', async () => {
  await windowOf('chrome://settings/');
  await idleFor('chrome://settings/', 13 * HOUR);

  await tick();

  expect(await openUrls()).toEqual(['https://on-screen.test/']);
  expect(await archivedUrls()).toEqual(['chrome://settings/']);
});

it('keeps a tab that the user viewed after it went old', async () => {
  await windowOf('https://old.test/');
  await idleFor('https://old.test/', 13 * HOUR);
  await browser.tabs.update((await tabOf('https://old.test/')).id as number, { active: true });
  await idleFor('https://on-screen.test/', 13 * HOUR);

  await tick();

  expect(await openUrls()).toEqual(['https://old.test/']);
  expect(await archivedUrls()).toEqual(['https://on-screen.test/']);
});
