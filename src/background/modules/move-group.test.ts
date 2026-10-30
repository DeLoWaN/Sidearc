import { beforeEach, describe, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

/** A page `host/path` is the address `https://host.test/path`, so that `docs/1` and `docs/2` are one site. */
const url = (page: string) => {
  const [host, path = ''] = page.split('/');
  return `https://${host}.test/${path}`;
};
const tabOf = async (page: string) =>
  (await browser.tabs.query({ url: url(page) }))[0]?.id as number;

/** The tabs of a window in strip order, as the page name, with `@group` when a Tab group holds the tab. */
async function strip(windowId: number) {
  const tabs = (await browser.tabs.query({ windowId })).sort((a, b) => a.index - b.index);
  return tabs.map((tab) => {
    const page = (tab.url as string)
      .replace(/^https:\/\//, '')
      .replace('.test/', '/')
      .replace(/\/$/, '');
    return tab.groupId === -1 ? page : `${page}@group`;
  });
}

/** Opens a window of the pages and a panel in it. `send` waits until the worker has handled the command. */
async function connectedWindow(pages: string[]) {
  const windowId = await fakeChrome.openWindow(pages.map(url));
  const panel = connectPanel(windowId);
  await settle();
  return {
    windowId,
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

async function groupTabs(pages: string[]) {
  const tabIds = await Promise.all(pages.map(tabOf));
  return (await browser.tabs.group({ tabIds: tabIds as [number, ...number[]] })) as number;
}

/** Opens the pages from the opener tab, so that they form a site group with it. */
async function openFrom(windowId: number, opener: string, pages: string[]) {
  const openerTabId = await tabOf(opener);
  for (const page of pages) {
    await browser.tabs.create({ url: url(page), windowId, active: false, openerTabId });
    await settle();
  }
}

describe('a Tab group', () => {
  it('moves forward to the index where its first tab ends', async () => {
    const { windowId, send } = await connectedWindow(['a', 'b', 'c', 'd', 'e']);
    const groupId = await groupTabs(['a', 'b']);

    await send({ type: 'group/move', groupId, index: 2, targetWindowId: windowId });

    expect(await strip(windowId)).toEqual(['c', 'd', 'a@group', 'b@group', 'e']);
  });

  it('moves back', async () => {
    const { windowId, send } = await connectedWindow(['a', 'b', 'c', 'd']);
    const groupId = await groupTabs(['c', 'd']);

    await send({ type: 'group/move', groupId, index: 1, targetWindowId: windowId });

    expect(await strip(windowId)).toEqual(['a', 'c@group', 'd@group', 'b']);
  });

  it('moves to the end with the index -1', async () => {
    const { windowId, send } = await connectedWindow(['a', 'b', 'c']);
    const groupId = await groupTabs(['a', 'b']);

    await send({ type: 'group/move', groupId, index: -1, targetWindowId: windowId });

    expect(await strip(windowId)).toEqual(['c', 'a@group', 'b@group']);
  });

  it('keeps its title, its colour and its collapsed state', async () => {
    const { windowId, send, state } = await connectedWindow(['a', 'b', 'c']);
    const groupId = await groupTabs(['a']);
    await browser.tabGroups.update(groupId, { title: 'Work', color: 'blue', collapsed: true });

    await send({ type: 'group/move', groupId, index: 2, targetWindowId: windowId });

    expect((await state())?.tabGroups).toEqual([
      expect.objectContaining({ id: groupId, title: 'Work', color: 'blue', collapsed: true }),
    ]);
  });

  it('moves into another window', async () => {
    const first = await connectedWindow(['a', 'b', 'c']);
    const second = await fakeChrome.openWindow([url('x'), url('y')]);
    const groupId = await groupTabs(['a', 'b']);

    await first.send({ type: 'group/move', groupId, index: 1, targetWindowId: second });

    expect(await strip(second)).toEqual(['x', 'a@group', 'b@group', 'y']);
    expect(await strip(first.windowId)).toEqual(['c']);
  });

  it('does nothing for a group that does not exist', async () => {
    const { windowId, send } = await connectedWindow(['a', 'b']);

    await send({ type: 'group/move', groupId: 404, index: 0, targetWindowId: windowId });

    expect(await strip(windowId)).toEqual(['a', 'b']);
  });

  it('adds no entry to the Undo list', async () => {
    const { windowId, send, state } = await connectedWindow(['a', 'b', 'c']);
    const groupId = await groupTabs(['a']);

    await send({ type: 'group/move', groupId, index: 2, targetWindowId: windowId });

    expect((await state())?.undo).toBeNull();
  });
});

describe('a site group', () => {
  /** The strip `mail`, `docs/1`, `news`, `docs/2`, `docs/3`: the group holds the three docs tabs. */
  async function docsWindow() {
    const world = await connectedWindow(['mail', 'docs/1', 'news']);
    await openFrom(world.windowId, 'docs/1', ['docs/2', 'docs/3']);
    const group = (await world.state())?.siteGroups[0];
    expect(group?.tabIds).toHaveLength(3);
    return { ...world, groupId: group?.id as string };
  }

  it('gathers its members at the index, in the order that they had', async () => {
    const { windowId, groupId, send } = await docsWindow();

    await send({ type: 'site-group/move', groupId, index: 0, targetWindowId: windowId });

    expect(await strip(windowId)).toEqual(['docs/1', 'docs/2', 'docs/3', 'mail', 'news']);
  });

  it('keeps its members together at a place in the middle', async () => {
    const { windowId, groupId, send } = await docsWindow();

    await send({ type: 'site-group/move', groupId, index: 1, targetWindowId: windowId });

    expect(await strip(windowId)).toEqual(['mail', 'docs/1', 'docs/2', 'docs/3', 'news']);
  });

  it('moves to the end with the index -1', async () => {
    const { windowId, groupId, send } = await docsWindow();

    await send({ type: 'site-group/move', groupId, index: -1, targetWindowId: windowId });

    expect(await strip(windowId)).toEqual(['mail', 'news', 'docs/1', 'docs/2', 'docs/3']);
  });

  it('keeps its name and its collapsed state', async () => {
    const { windowId, groupId, send, state } = await docsWindow();
    await send({ type: 'site-group/rename', groupId, name: 'Manual' });
    await send({ type: 'site-group/toggle', groupId });

    await send({ type: 'site-group/move', groupId, index: 0, targetWindowId: windowId });

    expect((await state())?.siteGroups).toEqual([
      expect.objectContaining({ id: groupId, name: 'Manual', collapsed: true }),
    ]);
  });

  it('brings a member of another window to the window of the drop', async () => {
    const { windowId, groupId, send, state } = await docsWindow();
    const second = await fakeChrome.openWindow([url('other')]);
    await openFrom(second, 'docs/1', ['docs/4']);
    expect((await state())?.siteGroups[0]?.tabIds).toHaveLength(4);

    await send({ type: 'site-group/move', groupId, index: 1, targetWindowId: windowId });

    expect(await strip(windowId)).toEqual(['mail', 'docs/1', 'docs/2', 'docs/3', 'docs/4', 'news']);
    expect(await strip(second)).toEqual(['other']);
  });

  it('does nothing for a group that does not exist', async () => {
    const { windowId, send } = await docsWindow();
    const before = await strip(windowId);

    await send({ type: 'site-group/move', groupId: 'nope', index: 0, targetWindowId: windowId });

    expect(await strip(windowId)).toEqual(before);
  });

  it('adds no entry to the Undo list', async () => {
    const { windowId, groupId, send, state } = await docsWindow();

    await send({ type: 'site-group/move', groupId, index: 0, targetWindowId: windowId });

    expect((await state())?.undo).toBeNull();
  });
});
