import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeItem, makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { ItemView, SidebarState } from '../../shared/types';
import { App } from '../App';
import { resetPanelStore, usePanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

const folder = (title: string, overrides: Partial<ItemView> = {}) =>
  makeItem({ kind: 'folder', url: '', title, ...overrides });

/**
 * The panel in this order:
 *   Pinned: Work (open) > W1, Shut (collapsed) > Hidden, P
 *   Unpinned: Mail, News, group Reading > Docs, Wiki, Blog
 */
function world() {
  const work = folder('Work', { position: 0 });
  const w1 = makeItem({ title: 'W1', parentId: work.id, position: 0 });
  const shut = folder('Shut', { position: 1, collapsed: true });
  const hidden = makeItem({ title: 'Hidden', parentId: shut.id, position: 0 });
  const p = makeItem({ title: 'P', position: 2 });
  const fav = makeItem({ kind: 'favorite', title: 'Fav', position: 0 });
  const [mail, news, docs, wiki, blog] = ['Mail', 'News', 'Docs', 'Wiki', 'Blog'].map((title) =>
    makeTab({ title }),
  );
  const tabs = [mail, news, docs, wiki, blog] as NonNullable<typeof mail>[];
  const state = makeState({
    items: [work, w1, shut, hidden, p, fav],
    unpinnedTabs: tabs,
    tabGroups: [
      {
        id: 5,
        windowId: 1,
        title: 'Reading',
        color: 'blue',
        collapsed: false,
        tabIds: [tabs[2]?.id as number, tabs[3]?.id as number],
      },
    ],
  });
  const ids = {
    work,
    w1,
    shut,
    hidden,
    p,
    fav,
    mail: tabs[0],
    news: tabs[1],
    docs: tabs[2],
    wiki: tabs[3],
    blog: tabs[4],
  };
  return { state, ...ids };
}

const row = (name: string) => screen.getByRole('button', { name });
const ctrlClick = (name: string) => fireEvent.click(row(name), { ctrlKey: true });
const shiftClick = (name: string) => fireEvent.click(row(name), { shiftKey: true });
const selectedRows = () =>
  screen
    .queryAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.textContent);

function renderWorld(state: SidebarState) {
  return renderPanel(<App />, { state });
}

describe('selecting with Ctrl or Cmd', () => {
  it('toggles an Unpinned Tab, a Pinned Tab and a Folder, and sends no command', () => {
    const { send } = renderWorld(world().state);

    ctrlClick('Mail');
    ctrlClick('P');
    ctrlClick('Work');
    expect(selectedRows()).toEqual(['Work', 'P', 'Mail']);

    fireEvent.click(row('P'), { metaKey: true });
    expect(selectedRows()).toEqual(['Work', 'Mail']);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not collapse a Folder', () => {
    const { send } = renderWorld(world().state);

    ctrlClick('Work');

    expect(send).not.toHaveBeenCalled();
    expect(row('Work')).toHaveAttribute('aria-expanded', 'true');
  });

  it('marks every row as pressed or not once a row is selected, and none before', () => {
    renderWorld(world().state);
    expect(row('Mail')).not.toHaveAttribute('aria-pressed');

    ctrlClick('Mail');

    expect(row('Mail')).toHaveAttribute('aria-pressed', 'true');
    expect(row('News')).toHaveAttribute('aria-pressed', 'false');
    expect(row('Mail').closest('li')).toHaveAttribute('data-selected');
    expect(row('News').closest('li')).not.toHaveAttribute('data-selected');
  });

  it('does not select a Favorite or a group header', () => {
    const { send } = renderWorld(world().state);

    ctrlClick('Fav');
    ctrlClick('Reading');

    expect(selectedRows()).toEqual([]);
    expect(send).toHaveBeenCalledWith({ type: 'item/open', itemId: expect.any(String) });
    expect(send).toHaveBeenCalledWith({ type: 'group/toggle', groupId: 5 });
  });
});

describe('selecting a range with Shift', () => {
  it('selects the visible rows from the anchor, skipping collapsed content and group headers', () => {
    renderWorld(world().state);

    ctrlClick('W1');
    shiftClick('News');

    expect(selectedRows()).toEqual(['W1', 'Shut', 'P', 'Mail', 'News']);
    expect(screen.queryByRole('button', { name: 'Hidden' })).toBeNull();
  });

  it('starts from the last row clicked with Ctrl or Shift, and replaces the selection', () => {
    renderWorld(world().state);
    ctrlClick('W1');
    shiftClick('News');

    shiftClick('Blog');

    expect(selectedRows()).toEqual(['News', 'Docs', 'Wiki', 'Blog']);
  });

  it('goes upwards as well', () => {
    renderWorld(world().state);
    ctrlClick('Wiki');

    shiftClick('Mail');

    expect(selectedRows()).toEqual(['Mail', 'News', 'Docs', 'Wiki']);
  });

  it('selects only the row when there is no anchor', () => {
    renderWorld(world().state);

    shiftClick('News');

    expect(selectedRows()).toEqual(['News']);
  });
});

describe('ending the selection', () => {
  it('ends with a plain click, which also does its normal action', async () => {
    const { send } = renderWorld(world().state);
    ctrlClick('Mail');
    ctrlClick('P');

    await userEvent.click(row('News'));

    expect(selectedRows()).toEqual([]);
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'tab/activate',
      tabId: expect.any(Number),
    });
  });

  it('collapses a Folder with a plain click and ends the selection', async () => {
    const { send } = renderWorld(world().state);
    ctrlClick('Mail');

    await userEvent.click(row('Work'));

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'folder/toggle',
      itemId: expect.any(String),
    });
    expect(selectedRows()).toEqual([]);
  });

  it('ends with Escape', () => {
    renderWorld(world().state);
    ctrlClick('Mail');

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(selectedRows()).toEqual([]);
  });

  it('ends with the Clear button', async () => {
    renderWorld(world().state);
    ctrlClick('Mail');

    const selectionBar = screen.getByRole('status').parentElement as HTMLElement;
    await userEvent.click(within(selectionBar).getByRole('button', { name: 'Clear' }));

    expect(selectedRows()).toEqual([]);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ends after any command, for example the delete cross of a row', async () => {
    const { send } = renderWorld(world().state);
    ctrlClick('Mail');

    await userEvent.click(screen.getByRole('button', { name: 'Delete P' }));

    expect(send).toHaveBeenCalledWith({ type: 'item/delete', itemId: expect.any(String) });
    expect(selectedRows()).toEqual([]);
  });

  it('keeps the selection when Escape closes a menu', async () => {
    renderWorld(world().state);
    ctrlClick('Mail');
    fireEvent.contextMenu(row('Mail'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(selectedRows()).toEqual(['Mail']);
  });
});

describe('what the selection counts', () => {
  it('counts a selected Folder once, and not a selected row inside it', () => {
    renderWorld(world().state);

    ctrlClick('W1');
    ctrlClick('Work');

    expect(screen.getByRole('status')).toHaveTextContent('1 selected');
  });

  it('shows the bar only while rows are selected, with the count and three buttons', () => {
    renderWorld(world().state);
    expect(screen.queryByRole('status')).toBeNull();

    ctrlClick('Mail');
    ctrlClick('P');

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('2 selected');
    const buttons = within(status.parentElement as HTMLElement).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Close', 'Move to…', 'Clear']);
  });

  it('drops the rows that leave the state', () => {
    const { state, mail, news } = world();
    renderWorld(state);
    ctrlClick('Mail');
    ctrlClick('News');
    expect(screen.getByRole('status')).toHaveTextContent('2 selected');

    act(() =>
      usePanelStore.getState().receive({
        ...state,
        unpinnedTabs: state.unpinnedTabs.filter((tab) => tab.id !== mail?.id),
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('1 selected');

    act(() =>
      usePanelStore.getState().receive({
        ...state,
        unpinnedTabs: state.unpinnedTabs.filter(
          (tab) => tab.id !== mail?.id && tab.id !== news?.id,
        ),
      }),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('closing the selection', () => {
  it('sends one command with the rows in the order of the panel', async () => {
    const { state, p, mail, news } = world();
    const { send } = renderWorld(state);
    ctrlClick('News');
    ctrlClick('P');
    ctrlClick('Mail');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'selection/close',
      tabIds: [mail?.id, news?.id],
      itemIds: [p.id],
    });
    expect(selectedRows()).toEqual([]);
  });

  it('closes with Delete and with Backspace', () => {
    const { send } = renderWorld(world().state);
    ctrlClick('Mail');

    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(send).toHaveBeenCalledTimes(1);

    ctrlClick('News');
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'selection/close' }));
  });

  it('does not close with Delete while a text field has the focus, and does nothing without a selection', () => {
    const { send } = renderWorld(world().state);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    ctrlClick('Mail');

    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search' }), { key: 'Delete' });

    expect(send).not.toHaveBeenCalled();
    expect(selectedRows()).toEqual(['Mail']);
  });

  it('asks first when a selected Folder holds items, and closes nothing before the answer', async () => {
    const { state, work } = world();
    const { send } = renderWorld(state);
    ctrlClick('Work');
    ctrlClick('Mail');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Close 2 items?' });
    expect(dialog).toHaveTextContent('Close 2 items? This includes 1 Folder with its content.');
    expect(send).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(send).not.toHaveBeenCalled();
    expect(selectedRows()).toEqual(['Work', 'Mail']);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close' }),
    );
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'selection/close',
      tabIds: [expect.any(Number)],
      itemIds: [work.id],
    });
  });

  it('asks nothing for an empty Folder', async () => {
    const empty = folder('Empty', { position: 0 });
    const { send } = renderWorld(
      makeState({ items: [empty], unpinnedTabs: [makeTab({ title: 'Mail' })] }),
    );
    ctrlClick('Empty');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'selection/close',
      tabIds: [],
      itemIds: [empty.id],
    });
  });
});

describe('the menus of the selection', () => {
  it('opens on a right click of a selected row and acts on the whole selection', async () => {
    const { state, p, mail } = world();
    const { send } = renderWorld(state);
    ctrlClick('Mail');
    ctrlClick('P');

    fireEvent.contextMenu(row('P'));
    const menu = screen.getByRole('menu', { name: 'Actions for 2 selected items' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((entry) => entry.textContent),
    ).toEqual(['Move to…', 'Close 2 items']);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Close 2 items' }));

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'selection/close',
      tabIds: [mail?.id],
      itemIds: [p.id],
    });
  });

  it('moves the whole selection with Move to… of the menu', async () => {
    const dest = folder('Dest', { position: 0 });
    const a = makeTab({ title: 'A' });
    const b = makeTab({ title: 'B' });
    const { send } = renderWorld(makeState({ items: [dest], unpinnedTabs: [a, b] }));
    ctrlClick('A');
    ctrlClick('B');

    fireEvent.contextMenu(row('B'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move to…' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Dest' }));

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'selection/move',
      tabIds: [a.id, b.id],
      itemIds: [],
      target: { kind: 'pinned', parentId: dest.id },
    });
  });

  it('shows the normal menu of an unselected row and ends the selection', () => {
    renderWorld(world().state);
    ctrlClick('Mail');

    fireEvent.contextMenu(row('News'));

    expect(selectedRows()).toEqual([]);
    expect(screen.getByRole('menu', { name: 'Actions for News' })).toBeInTheDocument();
  });
});

describe('Move to… of the bar', () => {
  it('lists the places that fit the whole selection and sends the same command as a drop', async () => {
    const dest = folder('Dest', { position: 0 });
    const a = makeTab({ title: 'A' });
    const b = makeTab({ title: 'B' });
    const group = {
      id: 9,
      windowId: 1,
      title: 'Reading',
      color: 'red' as const,
      collapsed: false,
      tabIds: [],
    };
    const { send } = renderWorld(
      makeState({ items: [dest], unpinnedTabs: [a, b], tabGroups: [group] }),
    );
    ctrlClick('A');
    ctrlClick('B');

    await userEvent.click(screen.getByRole('button', { name: 'Move to…' }));

    const menu = screen.getByRole('menu', { name: 'Move to' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((entry) => entry.textContent),
    ).toEqual(['Pinned Tabs', 'Dest', 'Reading']);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Reading' }));
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'selection/move',
      tabIds: [a.id, b.id],
      itemIds: [],
      target: { kind: 'tab-group', groupId: 9 },
    });
    expect(selectedRows()).toEqual([]);
  });

  it('is disabled when no place fits', () => {
    const { state } = world();
    renderWorld(state);

    ctrlClick('Work');
    ctrlClick('Shut');

    // Both Folders sit at the root, and no other Folder takes them.
    expect(screen.getByRole('button', { name: 'Move to…' })).toBeDisabled();
  });
});

describe('a search', () => {
  it('ends the selection and turns the selection off', async () => {
    const { send } = renderWorld(world().state);
    ctrlClick('Mail');

    act(() => usePanelUi.getState().setSearchQuery('mail'));
    expect(screen.queryByRole('status')).toBeNull();

    ctrlClick('Mail');
    expect(selectedRows()).toEqual([]);
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'tab/activate',
      tabId: expect.any(Number),
    });
  });
});
