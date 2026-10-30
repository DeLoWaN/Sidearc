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
