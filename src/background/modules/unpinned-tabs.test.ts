import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

/** Opens one window per list of URLs, then connects a panel in the first window. */
async function connectedPanel(urls: string[][]) {
  const windows: number[] = [];
  for (const group of urls) windows.push(await fakeChrome.openWindow(group));
  const panel = connectPanel(windows[0] as number);
  await settle();
  const shown = () => panel.latest()?.unpinnedTabs.map((tab) => tab.url);
  return { windows, panel, shown };
}

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0]?.id as number;

it('sends the tabs of all windows, in tab strip order, when the panel connects', async () => {
  const first = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  const second = await fakeChrome.openWindow(['https://c.test/']);
  const a = await tabOf('https://a.test/');
  await fakeChrome.patchTab(a, { title: 'Site A', favIconUrl: 'https://a.test/icon.png' });

  const panel = connectPanel(first);
  await settle();

  const tabs = panel.latest()?.unpinnedTabs;
  expect(tabs?.map((tab) => [tab.windowId, tab.index, tab.title, tab.url])).toEqual([
    [first, 0, 'Site A', 'https://a.test/'],
    [first, 1, 'https://b.test/', 'https://b.test/'],
    [second, 0, 'https://c.test/', 'https://c.test/'],
  ]);
  expect(tabs?.[0]?.iconUrl).toBe('https://a.test/icon.png');
  expect(tabs?.[0]?.id).toBe(a);
  expect(tabs?.[1]?.id).toBe(await tabOf('https://b.test/'));
});

it('uses the Chrome cache of site icons for a tab without a page icon', async () => {
  const { panel } = await connectedPanel([['https://a.test/page']]);

  const icon = new URL(panel.latest()?.unpinnedTabs[0]?.iconUrl as string);
  expect(icon.pathname).toBe('/_favicon/');
  expect(icon.searchParams.get('pageUrl')).toBe('https://a.test/page');
});

it('marks the active tab of each window', async () => {
  const { windows, panel } = await connectedPanel([
    ['https://a.test/', 'https://b.test/'],
    ['https://c.test/', 'https://d.test/'],
  ]);
  await browser.tabs.update(await tabOf('https://a.test/'), { active: true });
  await settle();

  const active = panel.latest()?.unpinnedTabs.filter((tab) => tab.active);
  expect(active?.map((tab) => [tab.windowId, tab.url])).toEqual([
    [windows[0], 'https://a.test/'],
    [windows[1], 'https://d.test/'],
  ]);
});

it('shows a tab that opens', async () => {
  const { windows, shown } = await connectedPanel([['https://a.test/']]);
  await browser.tabs.create({ windowId: windows[0], url: 'https://new.test/' });
  await settle();
  expect(shown()).toEqual(['https://a.test/', 'https://new.test/']);
});

it('drops a tab that closes', async () => {
  const { shown } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  await browser.tabs.remove(await tabOf('https://a.test/'));
  await settle();
  expect(shown()).toEqual(['https://b.test/']);
});

it('follows a tab that moves in the tab strip', async () => {
  const { shown } = await connectedPanel([
    ['https://a.test/', 'https://b.test/', 'https://c.test/'],
  ]);
  await browser.tabs.move(await tabOf('https://a.test/'), { index: 2 });
  await settle();
  expect(shown()).toEqual(['https://b.test/', 'https://c.test/', 'https://a.test/']);
});

it('shows a new title and a new icon', async () => {
  const { panel } = await connectedPanel([['https://a.test/']]);
  await fakeChrome.patchTab(await tabOf('https://a.test/'), {
    title: 'New title',
    favIconUrl: 'https://a.test/i.png',
  });
  await settle();
  expect(panel.latest()?.unpinnedTabs[0]).toMatchObject({
    title: 'New title',
    iconUrl: 'https://a.test/i.png',
  });
});

it('shows a tab under its new window after the tab changes window', async () => {
  const { windows, panel } = await connectedPanel([
    ['https://a.test/', 'https://b.test/'],
    ['https://c.test/'],
  ]);
  await browser.tabs.move(await tabOf('https://a.test/'), { windowId: windows[1], index: 0 });
  await settle();
  expect(panel.latest()?.unpinnedTabs.map((tab) => [tab.url, tab.windowId, tab.index])).toEqual([
    ['https://b.test/', windows[0], 0],
    ['https://a.test/', windows[1], 0],
    ['https://c.test/', windows[1], 1],
  ]);
});

it('drops the tabs of a window that closes', async () => {
  const { windows, shown } = await connectedPanel([['https://a.test/'], ['https://b.test/']]);
  await browser.windows.remove(windows[1] as number);
  await settle();
  expect(shown()).toEqual(['https://a.test/']);
});

it('sends nothing when a change does not touch what the panel shows', async () => {
  const { panel } = await connectedPanel([['https://a.test/']]);
  const before = panel.states.length;
  await fakeChrome.patchTab(await tabOf('https://a.test/'), { audible: true });
  await settle();
  expect(panel.states).toHaveLength(before);
});

it('sends every change to every connected panel', async () => {
  const { windows, panel } = await connectedPanel([['https://a.test/']]);
  const other = connectPanel(windows[0] as number);
  await settle();
  await browser.tabs.create({ windowId: windows[0], url: 'https://new.test/' });
  await settle();
  expect(panel.latest()?.unpinnedTabs).toHaveLength(2);
  expect(other.latest()).toEqual(panel.latest());
});

it('shows the right state again after the service worker restarted', async () => {
  const { windows } = await connectedPanel([['https://a.test/', 'https://b.test/']]);
  stopWorker();
  // The worker is stopped: these Chrome events reach no listener.
  await browser.tabs.remove(await tabOf('https://a.test/'));
  await browser.tabs.create({ windowId: windows[0], url: 'https://late.test/' });
  await settle();

  await startWorker();
  const reconnected = connectPanel(windows[0] as number);
  await settle();

  expect(reconnected.latest()?.unpinnedTabs.map((tab) => tab.url)).toEqual([
    'https://b.test/',
    'https://late.test/',
  ]);
  await browser.tabs.create({ windowId: windows[0], url: 'https://after.test/' });
  await settle();
  expect(reconnected.latest()?.unpinnedTabs).toHaveLength(3);
});
