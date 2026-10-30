import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { SiteGroupView, TabView } from '../../shared/types';
import { resetPanelStore } from '../store';
import { resetPanelUi } from '../ui-store';
import { UnpinnedSection } from './UnpinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

function makeSiteGroup(tabs: TabView[], overrides: Partial<SiteGroupView> = {}): SiteGroupView {
  return {
    id: 'site-1',
    host: 'docs.test',
    name: null,
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

it('shows a site group as a block named after its host', () => {
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
  expect(within(block).getByRole('button', { name: 'docs.test' })).toHaveTextContent('docs.test');
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
  ).toEqual(['Rename group', 'Ungroup', 'Close group']);
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Ungroup' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'site-group/ungroup', groupId: 'site-7' });
  expect(screen.queryByRole('menu')).toBeNull();
});

it('closes the site group from the "Close group" entry of the header menu, set apart by a separator', async () => {
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
  expect(within(menu).getAllByRole('separator')).toHaveLength(1);
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Close group' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'site-group/close', groupId: 'site-7' });
});

it('closes the site group with the cross at the right end of its header, named after the group', async () => {
  const [home, guide] = [makeTab(), makeTab()] as [TabView, TabView];
  const state = makeState({
    unpinnedTabs: [home, guide],
    siteGroups: [makeSiteGroup([home, guide], { id: 'site-7', name: 'Reading list' })],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await userEvent.click(screen.getByRole('button', { name: 'Close group Reading list' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'site-group/close', groupId: 'site-7' });
});

it('closes the site group when the user clicks its header with the middle button', async () => {
  const [home, guide] = [makeTab(), makeTab()] as [TabView, TabView];
  const state = makeState({
    unpinnedTabs: [home, guide],
    siteGroups: [makeSiteGroup([home, guide], { id: 'site-7' })],
  });
  const { send } = renderPanel(<UnpinnedSection />, { state });

  await userEvent.pointer({
    keys: '[MouseMiddle]',
    target: screen.getByRole('button', { name: 'docs.test' }),
  });

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'site-group/close', groupId: 'site-7' });
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

// --- rename

function renderNamed(name: string | null) {
  const [home, guide] = [makeTab(), makeTab()] as [TabView, TabView];
  return renderPanel(<UnpinnedSection />, {
    state: makeState({
      unpinnedTabs: [home, guide],
      siteGroups: [makeSiteGroup([home, guide], { id: 'site-7', name })],
    }),
  });
}

/** Right-clicks the header of the group with this name, then chooses "Rename group". */
async function startRename(name: string) {
  await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name }) });
  await userEvent.click(screen.getByRole('menuitem', { name: 'Rename group' }));
  return screen.getByRole('textbox', { name: `Name of ${name}` });
}

it('shows the custom name of a group in place of its host', () => {
  renderNamed('Reading list');

  const block = screen.getByRole('group', { name: 'Reading list' });
  expect(within(block).getByRole('button', { name: 'Reading list' })).toHaveTextContent(
    'Reading list',
  );
  expect(screen.queryByText('docs.test')).toBeNull();
});

it('opens a name field that holds the host, and sends the new name on Enter', async () => {
  const { send } = renderNamed(null);

  const field = await startRename('docs.test');
  expect(field).toHaveFocus();
  expect(field).toHaveValue('docs.test');
  await userEvent.clear(field);
  await userEvent.type(field, 'Reading list{Enter}');

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'site-group/rename',
    groupId: 'site-7',
    name: 'Reading list',
  });
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByRole('button', { name: 'docs.test' })).toBeVisible();
});

it('starts the edit from the custom name', async () => {
  renderNamed('Reading list');

  expect(await startRename('Reading list')).toHaveValue('Reading list');
});

it('sends an empty name when the user clears the field, to remove the custom name', async () => {
  const { send } = renderNamed('Reading list');

  const field = await startRename('Reading list');
  await userEvent.clear(field);
  await userEvent.type(field, '   {Enter}');

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'site-group/rename',
    groupId: 'site-7',
    name: '',
  });
});

it('sends nothing when the user leaves the name as it is, or presses Escape', async () => {
  const { send } = renderNamed(null);

  await userEvent.type(await startRename('docs.test'), '{Enter}');
  await userEvent.type(await startRename('docs.test'), 'Other{Escape}');

  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('sends nothing when the user clears a group that has no custom name', async () => {
  const { send } = renderNamed(null);

  const field = await startRename('docs.test');
  await userEvent.clear(field);
  await userEvent.type(field, '{Enter}');

  expect(send).not.toHaveBeenCalled();
});

it('sends the name when the field loses the focus', async () => {
  const { send } = renderNamed(null);

  const field = await startRename('docs.test');
  await userEvent.clear(field);
  await userEvent.type(field, 'Docs');
  await userEvent.tab();

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'site-group/rename',
    groupId: 'site-7',
    name: 'Docs',
  });
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
