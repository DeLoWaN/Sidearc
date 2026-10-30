import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { makeItem, makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { TabGroupView, TabView } from '../../shared/types';
import { resetPanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';
import { UnpinnedSection } from './UnpinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

function makeGroup(tabs: TabView[], overrides: Partial<TabGroupView> = {}): TabGroupView {
  return {
    id: 100,
    windowId: 1,
    title: 'Work',
    color: 'blue',
    collapsed: false,
    tabIds: tabs.map((tab) => tab.id),
    ...overrides,
  };
}

it('shows a Tab group as a block with its title and colour, between the other tabs', () => {
  const [before, inside1, inside2, after] = [
    makeTab({ title: 'Before' }),
    makeTab({ title: 'Docs' }),
    makeTab({ title: 'Mail' }),
    makeTab({ title: 'After' }),
  ] as [TabView, TabView, TabView, TabView];
  const state = makeState({
    unpinnedTabs: [before, inside1, inside2, after],
    tabGroups: [makeGroup([inside1, inside2], { title: 'Work', color: 'blue' })],
  });
  renderPanel(<UnpinnedSection />, { state });

  const block = screen.getByRole('group', { name: 'Work' });
  expect(block).toHaveAttribute('data-color', 'blue');
  expect(
    within(block)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['Docs', 'Mail']);
  // The block sits where its tabs are in the tab strip.
  const titles = screen.getAllByRole('listitem').map((row) => row.textContent);
  expect(titles).toEqual(['Before', 'Docs', 'Mail', 'After']);
  const outerList = within(screen.getByRole('region', { name: 'Unpinned Tabs' })).getAllByRole(
    'list',
  )[0];
  expect(outerList?.children).toHaveLength(3);
});

it('names a Tab group without a title', () => {
  const tab = makeTab();
  const state = makeState({ unpinnedTabs: [tab], tabGroups: [makeGroup([tab], { title: '' })] });
  renderPanel(<UnpinnedSection />, { state });

  expect(screen.getByRole('group', { name: 'Untitled group' })).toBeVisible();
});

it('asks the worker to toggle a Tab group when the user clicks its header', async () => {
  const tab = makeTab({ title: 'Docs' });
  const state = makeState({ unpinnedTabs: [tab], tabGroups: [makeGroup([tab], { id: 7 })] });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  const header = screen.getByRole('button', { name: 'Work' });
  expect(header).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(header);

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'group/toggle', groupId: 7 });
});

it('closes the Tab group when the user clicks its header with the middle button', async () => {
  const tab = makeTab({ title: 'Docs' });
  const state = makeState({ unpinnedTabs: [tab], tabGroups: [makeGroup([tab], { id: 7 })] });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await userEvent.pointer({
    keys: '[MouseMiddle]',
    target: screen.getByRole('button', { name: 'Work' }),
  });

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'group/close', groupId: 7 });
});

it('closes the Tab group with the cross at the right end of its header', async () => {
  const tab = makeTab({ title: 'Docs' });
  const state = makeState({ unpinnedTabs: [tab], tabGroups: [makeGroup([tab], { id: 7 })] });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await userEvent.click(screen.getByRole('button', { name: 'Close group Work' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'group/close', groupId: 7 });
});

it('offers the moves and "Close group" in the right-click menu of a Tab group header', async () => {
  const tab = makeTab({ title: 'Docs' });
  const state = makeState({ unpinnedTabs: [tab], tabGroups: [makeGroup([tab], { id: 7 })] });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await userEvent.pointer({
    keys: '[MouseRight]',
    target: screen.getByRole('button', { name: 'Work' }),
  });
  const menu = screen.getByRole('menu', { name: 'Actions for Work' });
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent),
  ).toEqual(['Move group up', 'Move group down', 'Close group']);
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Close group' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'group/close', groupId: 7 });
  expect(screen.queryByRole('menu')).toBeNull();
});

it('offers no way to close a Tab group while a search shows only some of its tabs', async () => {
  const tab = makeTab({ title: 'Docs' });
  const state = makeState({ unpinnedTabs: [tab], tabGroups: [makeGroup([tab], { id: 7 })] });
  const { send } = renderPanel(<UnpinnedSection />, { state });
  act(() => usePanelUi.getState().setSearchQuery('docs'));

  await userEvent.pointer({ keys: '[MouseMiddle]', target: screen.getByRole('group') });
  await userEvent.pointer({
    keys: '[MouseRight]',
    target: screen.getByRole('button', { name: 'Work' }),
  });

  expect(screen.queryByRole('button', { name: 'Close group Work' })).toBeNull();
  expect(screen.queryByRole('menu')).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

it('hides the tabs of a collapsed Tab group and shows how many there are', () => {
  const tabs = [makeTab({ title: 'Docs' }), makeTab({ title: 'Mail' })];
  const state = makeState({
    unpinnedTabs: tabs,
    tabGroups: [makeGroup(tabs, { collapsed: true })],
  });
  renderPanel(<UnpinnedSection />, { state });

  const header = screen.getByRole('button', { name: 'Work' });
  expect(header).toHaveAttribute('aria-expanded', 'false');
  expect(header).toHaveTextContent('2');
  expect(screen.queryByRole('button', { name: 'Docs' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Mail' })).toBeNull();
});

it('shows only the tabs of a Tab group that the panel lists', () => {
  const [listed, unlisted] = [makeTab({ title: 'Listed' }), makeTab({ title: 'Unlisted' })] as [
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: [listed],
    tabGroups: [
      makeGroup([listed, unlisted], { id: 1, title: 'Shown' }),
      makeGroup([unlisted], { id: 2, title: 'Empty' }),
    ],
  });
  renderPanel(<UnpinnedSection />, { state });

  expect(screen.getByRole('group', { name: 'Shown' })).toBeVisible();
  expect(screen.queryByRole('group', { name: 'Empty' })).toBeNull();
  expect(screen.queryByText('Unlisted')).toBeNull();
});

/** Right-clicks the Unpinned Tab with this title. */
const rightClick = (title: string) =>
  userEvent.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name: title }) });

/** Right-clicks the tab, then opens the "Move to…" submenu. */
async function openMoveTo(title: string) {
  await rightClick(title);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Move to…' }));
  return screen.getByRole('menu', { name: 'Move to…' });
}

it('offers Copy URL, Move to… and Close tab in the right-click menu of an Unpinned Tab', async () => {
  renderPanel(<UnpinnedSection />, {
    state: makeState({ unpinnedTabs: [makeTab({ title: 'Docs' })] }),
  });

  await rightClick('Docs');

  const menu = screen.getByRole('menu', { name: 'Actions for Docs' });
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent),
  ).toEqual(['Copy URL', 'Move to…', 'Close tab']);
  // The separator comes before the destructive entry.
  const [separator] = within(menu).getAllByRole('separator');
  const close = within(menu).getByRole('menuitem', { name: 'Close tab' });
  expect(separator?.compareDocumentPosition(close)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

it('copies the URL of an Unpinned Tab', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  const tab = makeTab({ title: 'Docs', url: 'https://docs.test/home' });
  renderPanel(<UnpinnedSection />, { state: makeState({ unpinnedTabs: [tab] }) });

  await rightClick('Docs');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Copy URL' }));

  expect(writeText).toHaveBeenCalledExactlyOnceWith('https://docs.test/home');
  expect(screen.queryByRole('menu')).toBeNull();
  vi.unstubAllGlobals();
});

it('closes the tab from its right-click menu', async () => {
  const tab = makeTab({ title: 'Docs' });
  const { send } = renderPanel(<UnpinnedSection />, {
    state: makeState({ unpinnedTabs: [tab] }),
  });

  await rightClick('Docs');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Close tab' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'tab/close', tabId: tab.id });
  expect(screen.queryByRole('menu')).toBeNull();
});

it('offers the Favorites, the Pinned Tabs and every Folder to an Unpinned Tab, and sends the save command', async () => {
  const tab = makeTab({ title: 'Docs' });
  const work = makeItem({ kind: 'folder', url: '', title: 'Work' });
  const state = makeState({ unpinnedTabs: [tab], items: [work] });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  const menu = await openMoveTo('Docs');
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent),
  ).toEqual(['Favorites', 'Pinned Tabs', 'Work']);
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Favorites' }));
  await userEvent.click(
    within(await openMoveTo('Docs')).getByRole('menuitem', { name: 'Pinned Tabs' }),
  );
  await userEvent.click(within(await openMoveTo('Docs')).getByRole('menuitem', { name: 'Work' }));

  expect(send.mock.calls.map(([command]) => command)).toEqual([
    { type: 'item/from-tab', tabId: tab.id, kind: 'favorite', parentId: null },
    { type: 'item/from-tab', tabId: tab.id, kind: 'pinned', parentId: null },
    { type: 'item/from-tab', tabId: tab.id, kind: 'pinned', parentId: work.id },
  ]);
});

it('offers every Tab group to a tab that is outside of all groups', async () => {
  const [loose, inside] = [makeTab({ title: 'Loose' }), makeTab({ title: 'Docs' })] as [
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: [loose, inside],
    tabGroups: [
      makeGroup([inside], { id: 7, title: 'Work' }),
      makeGroup([], { id: 8, title: 'Home' }),
    ],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  const menu = await openMoveTo('Loose');
  expect(within(menu).queryByRole('menuitem', { name: 'Out of group' })).toBeNull();
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Home' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'group/add-tab',
    tabId: loose.id,
    groupId: 8,
  });
  expect(screen.queryByRole('menu')).toBeNull();
});

it('offers to take a tab out of its Tab group, and not to put it in the same group', async () => {
  const inside = makeTab({ title: 'Docs' });
  const state = makeState({
    unpinnedTabs: [inside],
    tabGroups: [makeGroup([inside], { id: 7, title: 'Work' })],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  const menu = await openMoveTo('Docs');
  expect(within(menu).queryByRole('menuitem', { name: 'Work' })).toBeNull();
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Out of group' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'group/remove-tab', tabId: inside.id });
});

it('closes the menu on Escape without sending a command', async () => {
  const tab = makeTab({ title: 'Docs' });
  const state = makeState({
    unpinnedTabs: [tab],
    tabGroups: [makeGroup([], { id: 8, title: 'Home' })],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await openMoveTo('Docs');
  await userEvent.keyboard('{Escape}');

  expect(screen.queryByRole('menu')).toBeNull();
  expect(send).not.toHaveBeenCalled();
});
