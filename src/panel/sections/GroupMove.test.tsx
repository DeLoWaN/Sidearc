import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { SiteGroupView, TabGroupView, TabView } from '../../shared/types';
import { resetPanelDrag } from '../dnd/drag-store';
import { usePanelSelection } from '../selection-store';
import { resetPanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';
import { UnpinnedSection } from './UnpinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
  resetPanelDrag();
});

/** The strip `Mail`, `Docs 1` and `Docs 2` (Tab group "Work"), `News`, `Wiki 1` and `Wiki 2` (site group), `Last`. */
function world() {
  const [mail, docs1, docs2, news, wiki1, wiki2, last] = [
    ['Mail', 'https://mail.test/'],
    ['Docs 1', 'https://docs.test/1'],
    ['Docs 2', 'https://docs.test/2'],
    ['News', 'https://news.test/'],
    ['Wiki 1', 'https://wiki.test/1'],
    ['Wiki 2', 'https://wiki.test/2'],
    ['Last', 'https://last.test/'],
  ].map(([title, url], index) => makeTab({ id: index + 1, index, title, url })) as [
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
  ];
  const tabGroup: TabGroupView = {
    id: 100,
    windowId: 1,
    title: 'Work',
    color: 'blue',
    collapsed: false,
    tabIds: [docs1.id, docs2.id],
  };
  const siteGroup: SiteGroupView = {
    id: 'wiki',
    host: 'wiki.test',
    name: null,
    tabIds: [wiki1.id, wiki2.id],
    collapsed: false,
  };
  return {
    tabs: { mail, docs1, docs2, news, wiki1, wiki2, last },
    state: makeState({
      unpinnedTabs: [mail, docs1, docs2, news, wiki1, wiki2, last],
      tabGroups: [tabGroup],
      siteGroups: [siteGroup],
    }),
  };
}

/** The header of a group block: the row that holds its name button. */
const headerOf = (name: string) =>
  screen.getByRole('button', { name }).parentElement as HTMLElement;

const rightClick = (name: string) =>
  userEvent.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name }) });

describe('the header of a group', () => {
  it('is draggable for a Tab group and for a site group', () => {
    renderPanel(<UnpinnedSection />, { state: world().state });

    expect(headerOf('Work')).toHaveAttribute('draggable', 'true');
    expect(headerOf('wiki.test')).toHaveAttribute('draggable', 'true');
  });

  it('does not make the member rows part of the group drag', () => {
    renderPanel(<UnpinnedSection />, { state: world().state });

    const row = screen.getByRole('button', { name: 'Docs 1' }).closest('li') as HTMLElement;
    expect(headerOf('Work').contains(row)).toBe(false);
  });

  it('is not draggable while a search shows its results', () => {
    renderPanel(<UnpinnedSection />, { state: world().state });

    act(() => usePanelUi.getState().setSearchQuery('docs'));

    expect(headerOf('Work')).not.toHaveAttribute('draggable', 'true');
  });

  it('is not draggable while the user renames the group, and is again after', async () => {
    renderPanel(<UnpinnedSection />, { state: world().state });

    await rightClick('wiki.test');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename group' }));
    const field = screen.getByRole('textbox', { name: 'Name of wiki.test' });
    expect(field.closest('[draggable="true"]')).toBeNull();

    await userEvent.keyboard('{Escape}');
    expect(headerOf('wiki.test')).toHaveAttribute('draggable', 'true');
  });

  it('is not draggable while several rows are selected', () => {
    const { tabs, state } = world();
    renderPanel(<UnpinnedSection />, { state });

    act(() =>
      usePanelSelection.getState().replace(
        [
          { kind: 'tab', id: tabs.mail.id },
          { kind: 'tab', id: tabs.news.id },
        ],
        { kind: 'tab', id: tabs.news.id },
      ),
    );

    expect(headerOf('Work')).not.toHaveAttribute('draggable', 'true');
    expect(headerOf('wiki.test')).not.toHaveAttribute('draggable', 'true');
  });

  it('stays draggable while one row is selected', () => {
    const { tabs, state } = world();
    renderPanel(<UnpinnedSection />, { state });

    act(() =>
      usePanelSelection
        .getState()
        .replace([{ kind: 'tab', id: tabs.mail.id }], { kind: 'tab', id: tabs.mail.id }),
    );

    expect(headerOf('Work')).toHaveAttribute('draggable', 'true');
  });

  it('still collapses on a click, closes on the cross and closes on a middle click', async () => {
    const { send } = renderPanel(<UnpinnedSection />, { state: world().state });

    await userEvent.click(screen.getByRole('button', { name: 'Work' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close group Work' }));
    await userEvent.pointer({
      keys: '[MouseMiddle]',
      target: screen.getByRole('button', { name: 'wiki.test' }),
    });

    expect(send.mock.calls.map(([command]) => command)).toEqual([
      { type: 'group/toggle', groupId: 100 },
      { type: 'group/close', groupId: 100 },
      { type: 'site-group/close', groupId: 'wiki' },
    ]);
  });
});

describe('the right-click menu of a group header', () => {
  const entries = (menu: HTMLElement) =>
    within(menu)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent);

  it('has "Move group up" and "Move group down" above "Close group" for a Tab group', async () => {
    renderPanel(<UnpinnedSection />, { state: world().state });

    await rightClick('Work');

    const menu = screen.getByRole('menu', { name: 'Actions for Work' });
    expect(entries(menu)).toEqual(['Move group up', 'Move group down', 'Close group']);
  });

  it('has the same entries after "Rename group" and "Ungroup" for a site group', async () => {
    renderPanel(<UnpinnedSection />, { state: world().state });

    await rightClick('wiki.test');

    const menu = screen.getByRole('menu', { name: 'Actions for wiki.test' });
    expect(entries(menu)).toEqual([
      'Rename group',
      'Ungroup',
      'Move group up',
      'Move group down',
      'Close group',
    ]);
  });

  it('moves a Tab group above the previous tab and below the next tab', async () => {
    const { send } = renderPanel(<UnpinnedSection />, { state: world().state });

    await rightClick('Work');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move group up' }));
    await rightClick('Work');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move group down' }));

    expect(send.mock.calls.map(([command]) => command)).toEqual([
      { type: 'group/move', groupId: 100, index: 0, targetWindowId: 1 },
      { type: 'group/move', groupId: 100, index: 2, targetWindowId: 1 },
    ]);
  });

  it('moves a site group above the previous block and below the next tab', async () => {
    const { send } = renderPanel(<UnpinnedSection />, { state: world().state });

    await rightClick('wiki.test');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move group up' }));
    await rightClick('wiki.test');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move group down' }));

    expect(send.mock.calls.map(([command]) => command)).toEqual([
      // Above the News row: Mail, the Tab group, News, then the site group.
      { type: 'site-group/move', groupId: 'wiki', index: 3, targetWindowId: 1 },
      { type: 'site-group/move', groupId: 'wiki', index: 5, targetWindowId: 1 },
    ]);
  });

  it('disables "Move group up" for the first entry and "Move group down" for the last one', async () => {
    const { tabs, state } = world();
    const tabGroup = state.tabGroups[0] as TabGroupView;
    const reordered = makeState({
      unpinnedTabs: [
        { ...tabs.docs1, index: 0 },
        { ...tabs.docs2, index: 1 },
        { ...tabs.mail, index: 2 },
      ],
      tabGroups: [tabGroup],
    });
    const { send } = renderPanel(<UnpinnedSection />, { state: reordered });

    await rightClick('Work');
    const up = screen.getByRole('menuitem', { name: 'Move group up' });
    expect(up).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Move group down' })).not.toHaveAttribute(
      'aria-disabled',
    );
    await userEvent.click(up);

    expect(send).not.toHaveBeenCalled();
  });

  it('disables "Move group down" for the last entry', async () => {
    const { tabs, state: full } = world();
    const tabGroup = full.tabGroups[0] as TabGroupView;
    const state = makeState({
      unpinnedTabs: [
        { ...tabs.mail, index: 0 },
        { ...tabs.docs1, index: 1 },
        { ...tabs.docs2, index: 2 },
      ],
      tabGroups: [tabGroup],
    });
    renderPanel(<UnpinnedSection />, { state });

    await rightClick('Work');

    expect(screen.getByRole('menuitem', { name: 'Move group down' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('menuitem', { name: 'Move group up' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });
});
