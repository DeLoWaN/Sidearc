import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0]?.id as number;

/** The tabs of a window in strip order, each as `url` or `url@group` when it is in a Tab group. */
async function strip(windowId: number) {
  const tabs = (await browser.tabs.query({ windowId })).sort((a, b) => a.index - b.index);
  return tabs.map((tab) => (tab.groupId === -1 ? tab.url : `${tab.url}@${tab.groupId}`));
}

async function setup() {
  const windowId = await fakeChrome.openWindow([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
    'https://d.test/',
  ]);
  const panel = connectPanel(windowId);
  await settle();
  const groupId = (await browser.tabs.group({
    tabIds: [await tabOf('https://c.test/'), await tabOf('https://d.test/')] as [number, number],
  })) as number;
  return { windowId, panel, groupId };
}

it('moves a tab into a Tab group at the index when the command names the group', async () => {
  const { windowId, panel, groupId } = await setup();

  panel.send({ type: 'tab/move', tabId: await tabOf('https://a.test/'), index: 2, groupId });
  await settle();

  expect(await strip(windowId)).toEqual([
    'https://b.test/',
    `https://c.test/@${groupId}`,
    `https://a.test/@${groupId}`,
    `https://d.test/@${groupId}`,
  ]);
});

it('takes a tab out of its Tab group before it moves, when the group is null', async () => {
  const { windowId, panel, groupId } = await setup();

  panel.send({ type: 'tab/move', tabId: await tabOf('https://d.test/'), index: 0, groupId: null });
  await settle();

  expect(await strip(windowId)).toEqual([
    'https://d.test/',
    'https://a.test/',
    'https://b.test/',
    `https://c.test/@${groupId}`,
  ]);
});

it('keeps the Tab group of a tab that moves without a group in the command', async () => {
  const { windowId, panel, groupId } = await setup();

  panel.send({ type: 'tab/move', tabId: await tabOf('https://d.test/'), index: 2 });
  await settle();

  expect(await strip(windowId)).toEqual([
    'https://a.test/',
    'https://b.test/',
    `https://d.test/@${groupId}`,
    `https://c.test/@${groupId}`,
  ]);
});

it('moves a tab into another window at the index, without a reload', async () => {
  const { windowId, panel } = await setup();
  const other = await fakeChrome.openWindow(['https://x.test/', 'https://y.test/']);
  const moved = await tabOf('https://a.test/');

  panel.send({ type: 'tab/move', tabId: moved, index: 1, targetWindowId: other });
  await settle();

  expect(await strip(other)).toEqual(['https://x.test/', 'https://a.test/', 'https://y.test/']);
  expect((await browser.tabs.get(moved)).windowId).toBe(other);
  expect((await strip(windowId))[0]).toBe('https://b.test/');
});

it('takes the tab out of its Tab group when it moves to another window with a null group', async () => {
  const { panel } = await setup();
  const other = await fakeChrome.openWindow(['https://x.test/']);

  panel.send({
    type: 'tab/move',
    tabId: await tabOf('https://c.test/'),
    index: 0,
    groupId: null,
    targetWindowId: other,
  });
  await settle();

  expect(await strip(other)).toEqual(['https://c.test/', 'https://x.test/']);
});

it('joins a Tab group of the other window when the command names it', async () => {
  const { panel } = await setup();
  const other = await fakeChrome.openWindow(['https://x.test/', 'https://y.test/']);
  const otherGroup = (await browser.tabs.group({
    tabIds: [await tabOf('https://x.test/'), await tabOf('https://y.test/')] as [number, number],
  })) as number;

  panel.send({
    type: 'tab/move',
    tabId: await tabOf('https://a.test/'),
    index: 1,
    groupId: otherGroup,
    targetWindowId: other,
  });
  await settle();

  expect(await strip(other)).toEqual([
    `https://x.test/@${otherGroup}`,
    `https://a.test/@${otherGroup}`,
    `https://y.test/@${otherGroup}`,
  ]);
});
