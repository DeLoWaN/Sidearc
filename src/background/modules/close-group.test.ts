import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';
import type { ItemRecord, TabGroupColor } from '../../shared/types';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0]?.id as number;
const urlsOf = async (windowId: number) =>
  (await browser.tabs.query({ windowId })).map((tab) => tab.url);
const windowIds = async () => (await browser.windows.getAll()).map((window) => window.id);

/** Opens a window and a panel in it. `send` waits until the worker has handled the command. */
async function connectedWindow(urls: string[]) {
  const windowId = await fakeChrome.openWindow(urls);
  return { windowId, ...panelIn(windowId) };
}

function panelIn(windowId: number) {
  const panel = connectPanel(windowId);
  return {
    panel,
    send: async (command: Parameters<typeof panel.send>[0]) => {
      panel.send(command);
      await settle();
    },
    state: async () => {
      await settle();
      return panel.latest();
    },
  };
}

/** Opens `urls` in the window from the first tab of the window, so that they form a site group. */
async function openSiteGroup(windowId: number, opener: number, urls: string[]) {
  for (const url of urls) {
    await browser.tabs.create({ url, windowId, active: false, openerTabId: opener });
    await settle();
  }
}

async function makeTabGroup(urls: string[], title: string, color: TabGroupColor) {
  const tabIds = await Promise.all(urls.map(tabOf));
  const groupId = await (browser.tabs.group({
    tabIds: tabIds as [number, ...number[]],
  }) as Promise<number>);
  await browser.tabGroups.update(groupId, { title, color: color as chrome.tabGroups.Color });
  return groupId;
}

const DOCS = ['https://docs.test/a', 'https://docs.test/b', 'https://docs.test/c'];

it('closes every member of a site group and leaves the other tabs', async () => {
  const { windowId, send, state } = await connectedWindow([
    DOCS[0] as string,
    'https://mail.test/',
  ]);
  await openSiteGroup(windowId, await tabOf(DOCS[0] as string), DOCS.slice(1));
  const group = (await state())?.siteGroups[0];
  expect(group?.tabIds).toHaveLength(3);

  await send({ type: 'site-group/close', groupId: group?.id as string });

  expect(await urlsOf(windowId)).toEqual(['https://mail.test/']);
  expect((await state())?.siteGroups).toEqual([]);
});

it('closes a site group without archiving its tabs', async () => {
  const { windowId, send, state } = await connectedWindow([
    DOCS[0] as string,
    'https://mail.test/',
  ]);
  await openSiteGroup(windowId, await tabOf(DOCS[0] as string), [DOCS[1] as string]);
  const group = (await state())?.siteGroups[0];

  await send({ type: 'site-group/close', groupId: group?.id as string });

  expect((await state())?.archive).toEqual([]);
});

it('ignores a site group that does not exist', async () => {
  const { windowId, send, state } = await connectedWindow([
    DOCS[0] as string,
    'https://mail.test/',
  ]);

  await send({ type: 'site-group/close', groupId: 'nope' });

  expect(await urlsOf(windowId)).toEqual([DOCS[0], 'https://mail.test/']);
  expect((await state())?.undo).toBeNull();
});

it('names the undo entry after the host, or after the custom name of the site group', async () => {
  const { windowId, send, state } = await connectedWindow([
    DOCS[0] as string,
    'https://mail.test/',
  ]);
  await openSiteGroup(windowId, await tabOf(DOCS[0] as string), [DOCS[1] as string]);
  const group = (await state())?.siteGroups[0];

  await send({ type: 'site-group/close', groupId: group?.id as string });
  expect((await state())?.undo).toEqual({ label: 'Close group "docs.test"' });
  await send({ type: 'undo' });

  const restored = (await state())?.siteGroups[0];
  await send({ type: 'site-group/rename', groupId: restored?.id as string, name: 'Manual' });
  await send({ type: 'site-group/close', groupId: restored?.id as string });
  expect((await state())?.undo).toEqual({ label: 'Close group "Manual"' });
});

it('undo recreates the tabs of a site group in their places, not active, and groups them again with name and collapsed state', async () => {
  const { windowId, send, state } = await connectedWindow([
    'https://mail.test/',
    DOCS[0] as string,
    'https://news.test/',
  ]);
  await openSiteGroup(windowId, await tabOf(DOCS[0] as string), DOCS.slice(1));
  const before = await urlsOf(windowId);
  const group = (await state())?.siteGroups[0];
  await send({ type: 'site-group/rename', groupId: group?.id as string, name: 'Manual' });
  await send({ type: 'site-group/toggle', groupId: group?.id as string });
  await send({ type: 'site-group/close', groupId: group?.id as string });
  expect(await urlsOf(windowId)).toEqual(['https://mail.test/', 'https://news.test/']);

  await send({ type: 'undo' });

  expect(await urlsOf(windowId)).toEqual(before);
  const tabs = await browser.tabs.query({ windowId });
  const restored = tabs.filter((tab) => DOCS.includes(tab.url as string));
  expect(restored.every((tab) => !tab.active && tab.openerTabId === undefined)).toBe(true);
  expect((await state())?.siteGroups).toEqual([
    {
      id: expect.any(String),
      host: 'docs.test',
      name: 'Manual',
      tabIds: restored.map((tab) => tab.id),
      collapsed: true,
    },
  ]);
  expect((await state())?.undo).toBeNull();
});

it('does not mark the recreated tabs as not visited, and forms no second site group', async () => {
  const { windowId, send, state } = await connectedWindow([
    DOCS[0] as string,
    'https://mail.test/',
  ]);
  await openSiteGroup(windowId, await tabOf(DOCS[0] as string), [DOCS[1] as string]);
  const group = (await state())?.siteGroups[0];
  await send({ type: 'site-group/close', groupId: group?.id as string });

  await send({ type: 'undo' });

  const after = await state();
  expect(after?.siteGroups).toHaveLength(1);
  expect(after?.unpinnedTabs.filter((tab) => tab.unvisited)).toEqual([]);
});

it('closes the window that held only the site group, and undo puts the tabs in the window of the panel', async () => {
  const first = await connectedWindow(['https://mail.test/']);
  const second = await fakeChrome.openWindow([DOCS[0] as string]);
  await openSiteGroup(second, await tabOf(DOCS[0] as string), [DOCS[1] as string]);
  const group = (await first.state())?.siteGroups[0];
  expect(group?.tabIds).toHaveLength(2);

  await first.send({ type: 'site-group/close', groupId: group?.id as string });

  expect(await windowIds()).toEqual([first.windowId]);
  expect(await urlsOf(first.windowId)).toEqual(['https://mail.test/']);

  await first.send({ type: 'undo' });

  expect(await windowIds()).toEqual([first.windowId]);
  expect(await urlsOf(first.windowId)).toEqual(['https://mail.test/', DOCS[0], DOCS[1]]);
  expect((await first.state())?.siteGroups).toHaveLength(1);
});

it('closes every shown member of a Tab group and removes the group', async () => {
  const { windowId, send, state } = await connectedWindow([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
  ]);
  const groupId = await makeTabGroup(['https://a.test/', 'https://b.test/'], 'Work', 'cyan');
  expect((await state())?.tabGroups).toHaveLength(1);

  await send({ type: 'group/close', groupId });

  expect(await urlsOf(windowId)).toEqual(['https://c.test/']);
  expect((await state())?.tabGroups).toEqual([]);
  expect((await state())?.archive).toEqual([]);
  expect((await state())?.undo).toEqual({ label: 'Close group "Work"' });
});

it('ignores a Tab group that does not exist', async () => {
  const { windowId, send, state } = await connectedWindow(['https://a.test/']);

  await send({ type: 'group/close', groupId: 999 });

  expect(await urlsOf(windowId)).toEqual(['https://a.test/']);
  expect((await state())?.undo).toBeNull();
});

it('names the undo entry of an untitled Tab group after its colour', async () => {
  const { send, state } = await connectedWindow(['https://a.test/', 'https://b.test/']);
  const groupId = await makeTabGroup(['https://a.test/'], '', 'orange');

  await send({ type: 'group/close', groupId });

  expect((await state())?.undo).toEqual({ label: 'Close group "orange"' });
});

it('undo recreates the Tab group with its title, colour and collapsed state, and puts the tabs back in order', async () => {
  const { windowId, send, state } = await connectedWindow([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
    'https://d.test/',
  ]);
  const groupId = await makeTabGroup(['https://b.test/', 'https://c.test/'], 'Work', 'cyan');
  await browser.tabGroups.update(groupId, { collapsed: true });
  await send({ type: 'group/close', groupId });
  expect(await urlsOf(windowId)).toEqual(['https://a.test/', 'https://d.test/']);

  await send({ type: 'undo' });

  expect(await urlsOf(windowId)).toEqual([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
    'https://d.test/',
  ]);
  const tabs = await browser.tabs.query({ windowId });
  const [b, c] = [tabs[1], tabs[2]];
  expect(b?.active || c?.active).toBe(false);
  expect((await state())?.tabGroups).toEqual([
    {
      id: expect.any(Number),
      windowId,
      title: 'Work',
      color: 'cyan',
      collapsed: true,
      tabIds: [b?.id, c?.id],
    },
  ]);
  expect((await state())?.undo).toBeNull();
});

it('closes the window that held only the Tab group, and undo recreates the group in the window of the panel', async () => {
  const first = await connectedWindow(['https://mail.test/']);
  const second = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  const groupId = await makeTabGroup(['https://a.test/', 'https://b.test/'], 'Work', 'red');

  await first.send({ type: 'group/close', groupId });
  expect(await windowIds()).toEqual([first.windowId]);

  await first.send({ type: 'undo' });

  expect(second).not.toBe(first.windowId);
  expect(await urlsOf(first.windowId)).toEqual([
    'https://mail.test/',
    'https://a.test/',
    'https://b.test/',
  ]);
  expect((await first.state())?.tabGroups).toMatchObject([
    { windowId: first.windowId, title: 'Work', color: 'red' },
  ]);
});

it('keeps the live tab of a Pinned Tab that sits in the Tab group, and undo puts the tabs back in that group', async () => {
  const pinned: ItemRecord = {
    id: 'p',
    kind: 'pinned',
    title: 'Pinned',
    url: 'https://pinned.test/',
    parentId: null,
    position: 0,
    collapsed: false,
  };
  await browser.storage.local.set({ items: [pinned] });
  const { windowId, send, state } = await connectedWindow(['https://a.test/', 'https://b.test/']);
  await send({ type: 'item/open', itemId: 'p' });
  const groupId = await makeTabGroup(['https://a.test/', 'https://pinned.test/'], 'Mixed', 'pink');
  const liveTab = await tabOf('https://pinned.test/');

  await send({ type: 'group/close', groupId });

  expect(await urlsOf(windowId)).toEqual(['https://b.test/', 'https://pinned.test/']);
  expect((await browser.tabs.get(liveTab)).groupId).toBe(groupId);

  await send({ type: 'undo' });

  const tabs = await browser.tabs.query({ windowId });
  const grouped = tabs.filter((tab) => tab.groupId === groupId).map((tab) => tab.url);
  expect(grouped.sort()).toEqual(['https://a.test/', 'https://pinned.test/']);
  expect((await state())?.tabGroups).toHaveLength(1);
});

it('keeps one undo entry per group close, newest first', async () => {
  const { windowId, send } = await connectedWindow([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
  ]);
  const first = await makeTabGroup(['https://a.test/'], 'One', 'blue');
  const second = await makeTabGroup(['https://b.test/'], 'Two', 'green');
  await send({ type: 'group/close', groupId: first });
  await send({ type: 'group/close', groupId: second });
  expect(await urlsOf(windowId)).toEqual(['https://c.test/']);

  await send({ type: 'undo' });
  expect(await urlsOf(windowId)).toEqual(['https://b.test/', 'https://c.test/']);

  await send({ type: 'undo' });
  expect(await urlsOf(windowId)).toEqual(['https://a.test/', 'https://b.test/', 'https://c.test/']);
});
