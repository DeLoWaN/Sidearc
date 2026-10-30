import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { SiteGroupView, TabView } from '../../shared/types';
import { resetPanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';
import { UnpinnedSection } from './UnpinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

function makeSiteGroup(tabs: TabView[], overrides: Partial<SiteGroupView> = {}): SiteGroupView {
  return {
    id: 'site-1',
    host: 'docs.test',
    tabIds: tabs.map((tab) => tab.id),
    collapsed: false,
    ...overrides,
  };
}

/** Three tabs in strip order: one outside, two on docs.test. */
function threeTabs() {
  return [
    makeTab({ title: 'Docs home', url: 'https://docs.test/' }),
    makeTab({ title: 'Mail', url: 'https://mail.test/' }),
    makeTab({ title: 'Docs guide', url: 'https://docs.test/guide' }),
  ] as [TabView, TabView, TabView];
}

it('shows a site group as a block with its host and its member count', () => {
  const [home, guide] = [makeTab({ title: 'Home' }), makeTab({ title: 'Guide' })] as [
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: [home, guide],
    siteGroups: [makeSiteGroup([home, guide])],
  });
  renderPanel(<UnpinnedSection />, { state });

  const block = screen.getByRole('group', { name: 'docs.test' });
  expect(block).toHaveAttribute('data-site-group');
  expect(block).not.toHaveAttribute('data-color');
  const header = within(block).getByRole('button', { name: 'docs.test' });
  expect(header).toHaveTextContent('2');
  expect(header.querySelector('img')).toBeInTheDocument();
});

it('puts every member in the block at the place of the first one, even with another tab between them', () => {
  const [home, mail, guide] = threeTabs();
  const state = makeState({
    unpinnedTabs: [home, mail, guide],
    siteGroups: [makeSiteGroup([home, guide])],
  });
  renderPanel(<UnpinnedSection />, { state });

  const block = screen.getByRole('group', { name: 'docs.test' });
  expect(
    within(block)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['Docs home', 'Docs guide']);
  const outerList = within(screen.getByRole('region', { name: 'Unpinned Tabs' })).getAllByRole(
    'list',
  )[0];
  expect(outerList?.children).toHaveLength(2);
  expect(outerList?.children[0]).toContainElement(block);
  expect(outerList?.children[1]).toHaveTextContent('Mail');
});

it('asks the worker to toggle the site group when the user clicks its header', async () => {
  const [home, guide] = [makeTab(), makeTab()] as [TabView, TabView];
  const state = makeState({
    unpinnedTabs: [home, guide],
    siteGroups: [makeSiteGroup([home, guide], { id: 'site-7' })],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  const header = screen.getByRole('button', { name: 'docs.test' });
  expect(header).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(header);

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'site-group/toggle', groupId: 'site-7' });
});

it('hides the members of a collapsed site group and keeps the count', () => {
  const tabs = [makeTab({ title: 'Home' }), makeTab({ title: 'Guide' })] as [TabView, TabView];
  const state = makeState({
    unpinnedTabs: tabs,
    siteGroups: [makeSiteGroup(tabs, { collapsed: true })],
  });
  renderPanel(<UnpinnedSection />, { state });

  const header = screen.getByRole('button', { name: 'docs.test' });
  expect(header).toHaveAttribute('aria-expanded', 'false');
  expect(header).toHaveTextContent('2');
  expect(screen.queryByRole('button', { name: 'Home' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Guide' })).toBeNull();
});

it('shows the unvisited dot on the header of a collapsed group with an unvisited member', () => {
  const tabs = [makeTab({ title: 'Home' }), makeTab({ title: 'Guide', unvisited: true })] as [
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: tabs,
    siteGroups: [makeSiteGroup(tabs, { collapsed: true })],
  });
  renderPanel(<UnpinnedSection />, { state });

  const header = screen.getByRole('button', { name: 'docs.test' });
  expect(within(header).getByRole('img', { name: 'Not visited yet' })).toBeVisible();
});

it('shows no unvisited dot on the header of an expanded group', () => {
  const tabs = [makeTab({ title: 'Home' }), makeTab({ title: 'Guide', unvisited: true })] as [
    TabView,
    TabView,
  ];
  renderPanel(<UnpinnedSection />, {
    state: makeState({ unpinnedTabs: tabs, siteGroups: [makeSiteGroup(tabs)] }),
  });

  const header = screen.getByRole('button', { name: 'docs.test' });
  expect(within(header).queryByRole('img', { name: 'Not visited yet' })).toBeNull();
  // The member row keeps its own dot.
  expect(screen.getAllByRole('img', { name: 'Not visited yet' })).toHaveLength(1);
});

it('offers "Ungroup" in the right-click menu of the header and sends the command', async () => {
  const [home, guide] = [makeTab(), makeTab()] as [TabView, TabView];
  const state = makeState({
    unpinnedTabs: [home, guide],
    siteGroups: [makeSiteGroup([home, guide], { id: 'site-7' })],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await userEvent.pointer({
    keys: '[MouseRight]',
    target: screen.getByRole('button', { name: 'docs.test' }),
  });
  const menu = screen.getByRole('menu', { name: 'Actions for docs.test' });
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent),
  ).toEqual(['Ungroup']);
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Ungroup' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'site-group/ungroup', groupId: 'site-7' });
  expect(screen.queryByRole('menu')).toBeNull();
});

it('offers "Remove from group" to a member tab and sends the command', async () => {
  const [home, guide] = [makeTab({ title: 'Home' }), makeTab({ title: 'Guide' })] as [
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: [home, guide],
    siteGroups: [makeSiteGroup([home, guide])],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await userEvent.pointer({
    keys: '[MouseRight]',
    target: screen.getByRole('button', { name: 'Guide' }),
  });
  const menu = screen.getByRole('menu', { name: 'Actions for Guide' });
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent),
  ).toEqual(['Copy URL', 'Move to…', 'Remove from group', 'Close tab']);
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Remove from group' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'site-group/remove-tab', tabId: guide.id });
});

it('does not offer "Remove from group" to a tab outside of all groups', async () => {
  const [home, mail, guide] = threeTabs();
  const state = makeState({
    unpinnedTabs: [home, mail, guide],
    siteGroups: [makeSiteGroup([home, guide])],
  });
  renderPanel(<UnpinnedSection />, { state });

  await userEvent.pointer({
    keys: '[MouseRight]',
    target: screen.getByRole('button', { name: 'Mail' }),
  });

  expect(screen.queryByRole('menuitem', { name: 'Remove from group' })).toBeNull();
});

it('keeps the middle click closing a member tab', async () => {
  const [home, guide] = [makeTab({ title: 'Home' }), makeTab({ title: 'Guide' })] as [
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: [home, guide],
    siteGroups: [makeSiteGroup([home, guide])],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await userEvent.pointer({
    keys: '[MouseMiddle]',
    target: screen.getByRole('button', { name: 'Guide' }),
  });

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'tab/close', tabId: guide.id });
});

it('ignores a middle click on the header of a site group', async () => {
  const [home, guide] = [makeTab(), makeTab()] as [TabView, TabView];
  const state = makeState({
    unpinnedTabs: [home, guide],
    siteGroups: [makeSiteGroup([home, guide])],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await userEvent.pointer({
    keys: '[MouseMiddle]',
    target: screen.getByRole('button', { name: 'docs.test' }),
  });

  expect(send).not.toHaveBeenCalled();
});

it('expands a collapsed group and lists only the matching members while a search runs', () => {
  const [home, mail, guide] = threeTabs();
  const state = makeState({
    unpinnedTabs: [home, mail, guide],
    siteGroups: [makeSiteGroup([home, guide], { collapsed: true })],
  });
  renderPanel(<UnpinnedSection />, { state });
  act(() => usePanelUi.getState().setSearchQuery('guide'));

  const block = screen.getByRole('group', { name: 'docs.test' });
  expect(
    within(block)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['Docs guide']);
  expect(screen.queryByRole('button', { name: 'Mail' })).toBeNull();
});

it('draws no block for a group none of whose members the panel lists', () => {
  const [home, guide] = [makeTab(), makeTab()] as [TabView, TabView];
  const state = makeState({ unpinnedTabs: [], siteGroups: [makeSiteGroup([home, guide])] });
  renderPanel(<UnpinnedSection />, { state });

  expect(screen.queryByRole('group')).toBeNull();
});

it('leaves a tab that is in a Chrome Tab group and in a site group to the Chrome Tab group', () => {
  const [home, guide] = [makeTab({ title: 'Home' }), makeTab({ title: 'Guide' })] as [
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: [home, guide],
    tabGroups: [
      { id: 5, windowId: 1, title: 'Work', color: 'blue', collapsed: false, tabIds: [guide.id] },
    ],
    siteGroups: [makeSiteGroup([home, guide])],
  });
  renderPanel(<UnpinnedSection />, { state });

  expect(
    within(screen.getByRole('group', { name: 'Work' }))
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['Guide']);
  expect(
    within(screen.getByRole('group', { name: 'docs.test' }))
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['Home']);
});
