import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';
import type { TabGroupColor } from '../../shared/types';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0]?.id as number;

/** Puts the tabs with these URLs in a new Tab group with this title and colour. */
async function makeGroup(urls: string[], title: string, color: TabGroupColor) {
  const tabIds = await Promise.all(urls.map(tabOf));
  const groupId = await (browser.tabs.group({
    tabIds: tabIds as [number, ...number[]],
  }) as Promise<number>);
  await browser.tabGroups.update(groupId, { title, color: color as chrome.tabGroups.Color });
  return groupId;
}

/** Opens a window with these URLs and a connected panel that shows its Tab groups. */
async function connectedPanel(urls: string[]) {
  const windowId = await fakeChrome.openWindow(urls);
  const panel = connectPanel(windowId);
  await settle();
  const shown = () => panel.latest()?.tabGroups.map(({ title, color }) => ({ title, color }));
  return { windowId, panel, shown };
}

it('sends each Tab group with its title, colour and tabs, in tab strip order', async () => {
  const first = await fakeChrome.openWindow([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
  ]);
  const second = await fakeChrome.openWindow(['https://d.test/', 'https://e.test/']);
  const later = await makeGroup(['https://c.test/'], 'Later', 'blue');
  const earlier = await makeGroup(['https://a.test/', 'https://b.test/'], 'Earlier', 'red');
  const other = await makeGroup(['https://e.test/'], 'Other window', 'green');

  const panel = connectPanel(first);
  await settle();

  expect(panel.latest()?.tabGroups).toEqual([
    {
      id: earlier,
      windowId: first,
      title: 'Earlier',
      color: 'red',
      collapsed: false,
      tabIds: [await tabOf('https://a.test/'), await tabOf('https://b.test/')],
    },
    {
      id: later,
      windowId: first,
      title: 'Later',
      color: 'blue',
      collapsed: false,
      tabIds: [await tabOf('https://c.test/')],
    },
    {
      id: other,
      windowId: second,
      title: 'Other window',
      color: 'green',
      collapsed: false,
      tabIds: [await tabOf('https://e.test/')],
    },
  ]);
});

it('shows a Tab group that is created in Chrome', async () => {
  const { panel, shown } = await connectedPanel(['https://a.test/', 'https://b.test/']);
  expect(panel.latest()?.tabGroups).toEqual([]);

  await makeGroup(['https://a.test/'], 'Work', 'cyan');
  await settle();

  expect(shown()).toEqual([{ title: 'Work', color: 'cyan' }]);
});

it('shows a new title and a new colour of a Tab group', async () => {
  const { shown } = await connectedPanel(['https://a.test/']);
  const group = await makeGroup(['https://a.test/'], 'Work', 'cyan');
  await settle();

  await browser.tabGroups.update(group, { title: 'Home' });
  await settle();
  expect(shown()).toEqual([{ title: 'Home', color: 'cyan' }]);

  await browser.tabGroups.update(group, { color: 'pink' });
  await settle();
  expect(shown()).toEqual([{ title: 'Home', color: 'pink' }]);
});

it('shows the tabs that join or leave a Tab group', async () => {
  const { panel } = await connectedPanel(['https://a.test/', 'https://b.test/', 'https://c.test/']);
  const group = await makeGroup(['https://a.test/'], 'Work', 'cyan');
  const [a, b] = [await tabOf('https://a.test/'), await tabOf('https://b.test/')];

  await browser.tabs.group({ tabIds: [b], groupId: group });
  await settle();
  expect(panel.latest()?.tabGroups[0]?.tabIds).toEqual([a, b]);

  await browser.tabs.ungroup(a);
  await settle();
  expect(panel.latest()?.tabGroups[0]?.tabIds).toEqual([b]);
});

it('drops a Tab group that Chrome removes', async () => {
  const { panel, shown } = await connectedPanel(['https://a.test/', 'https://b.test/']);
  await makeGroup(['https://a.test/'], 'Work', 'cyan');
  await settle();
  expect(shown()).toHaveLength(1);

  await browser.tabs.ungroup(await tabOf('https://a.test/'));
  await settle();

  expect(panel.latest()?.tabGroups).toEqual([]);
});

it('collapses the Tab group in the tab strip when the panel collapses it, and expands it again', async () => {
  const { panel } = await connectedPanel(['https://a.test/']);
  const group = await makeGroup(['https://a.test/'], 'Work', 'cyan');
  await settle();

  panel.send({ type: 'group/toggle', groupId: group });
  await settle();
  expect((await browser.tabGroups.get(group)).collapsed).toBe(true);
  expect(panel.latest()?.tabGroups[0]?.collapsed).toBe(true);

  panel.send({ type: 'group/toggle', groupId: group });
  await settle();
  expect((await browser.tabGroups.get(group)).collapsed).toBe(false);
  expect(panel.latest()?.tabGroups[0]?.collapsed).toBe(false);
});

it('collapses the block in the panel when the Tab group collapses in the tab strip', async () => {
  const { panel } = await connectedPanel(['https://a.test/']);
  const group = await makeGroup(['https://a.test/'], 'Work', 'cyan');

  await browser.tabGroups.update(group, { collapsed: true });
  await settle();
  expect(panel.latest()?.tabGroups[0]?.collapsed).toBe(true);

  await browser.tabGroups.update(group, { collapsed: false });
  await settle();
  expect(panel.latest()?.tabGroups[0]?.collapsed).toBe(false);
});

it('moves a tab into a Tab group, also when the tab is in another window', async () => {
  const { windowId, panel } = await connectedPanel(['https://a.test/', 'https://b.test/']);
  const other = await fakeChrome.openWindow(['https://c.test/']);
  const group = await makeGroup(['https://a.test/'], 'Work', 'cyan');
  const [a, b, c] = await Promise.all(
    ['https://a.test/', 'https://b.test/', 'https://c.test/'].map(tabOf),
  );

  panel.send({ type: 'group/add-tab', tabId: b as number, groupId: group });
  await settle();
  panel.send({ type: 'group/add-tab', tabId: c as number, groupId: group });
  await settle();

  expect(panel.latest()?.tabGroups[0]?.tabIds).toEqual([a, b, c]);
  expect((await browser.tabs.get(c as number)).windowId).toBe(windowId);
  expect(await browser.windows.get(other).catch(() => undefined)).toBeUndefined();
});

it('moves a tab out of its Tab group', async () => {
  const { panel } = await connectedPanel(['https://a.test/', 'https://b.test/']);
  const group = await makeGroup(['https://a.test/', 'https://b.test/'], 'Work', 'cyan');
  const [a, b] = [await tabOf('https://a.test/'), await tabOf('https://b.test/')];
  await settle();

  panel.send({ type: 'group/remove-tab', tabId: a });
  await settle();

  expect(panel.latest()?.tabGroups[0]?.tabIds).toEqual([b]);
  expect((await browser.tabs.get(a)).groupId).toBe(-1);
  expect(await browser.tabGroups.get(group)).toMatchObject({ title: 'Work' });
});

it('shows the right Tab groups again after the service worker restarted', async () => {
  const { windowId } = await connectedPanel(['https://a.test/']);
  const group = await makeGroup(['https://a.test/'], 'Work', 'cyan');
  stopWorker();
  await browser.tabGroups.update(group, { title: 'Renamed while stopped' });

  await startWorker();
  const reconnected = connectPanel(windowId);
  await settle();

  expect(reconnected.latest()?.tabGroups[0]?.title).toBe('Renamed while stopped');
});
