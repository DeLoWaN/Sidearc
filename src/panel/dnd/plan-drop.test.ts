import { describe, expect, it } from 'vitest';
import { makeItem, makeState, makeTab } from '../../../tests/support/builders';
import type { ItemView, TabGroupView, TabView } from '../../shared/types';
import { itemMoveTargets, tabMoveTargets } from '../move-targets';
import { planDrop } from './plan-drop';
import type { DropTarget } from './types';

const folder = (title: string, overrides: Partial<ItemView> = {}) =>
  makeItem({ kind: 'folder', url: '', title, ...overrides });
const favorite = (title: string, position: number) =>
  makeItem({ kind: 'favorite', title, position, parentId: null });

const item = (source: ItemView) => ({ type: 'item' as const, itemId: source.id });
const tab = (source: TabView) => ({ type: 'tab' as const, tabId: source.id });

describe('an item dropped in the Pinned Tabs tree', () => {
  const a = makeItem({ title: 'A', position: 0 });
  const b = makeItem({ title: 'B', position: 1 });
  const c = makeItem({ title: 'C', position: 2 });
  const state = makeState({ items: [a, b, c] });

  it('goes above another row: the index counts the siblings without the item', () => {
    expect(
      planDrop(state, item(c), { zone: 'tree-row', itemId: a.id, placement: 'above' }),
    ).toEqual({ type: 'item/move', itemId: c.id, parentId: null, index: 0 });
    expect(
      planDrop(state, item(a), { zone: 'tree-row', itemId: c.id, placement: 'above' }),
    ).toEqual({ type: 'item/move', itemId: a.id, parentId: null, index: 1 });
  });

  it('goes below another row', () => {
    expect(
      planDrop(state, item(a), { zone: 'tree-row', itemId: c.id, placement: 'below' }),
    ).toEqual({ type: 'item/move', itemId: a.id, parentId: null, index: 2 });
    expect(
      planDrop(state, item(c), { zone: 'tree-row', itemId: a.id, placement: 'below' }),
    ).toEqual({ type: 'item/move', itemId: c.id, parentId: null, index: 1 });
  });

  it('is refused on itself', () => {
    expect(
      planDrop(state, item(a), { zone: 'tree-row', itemId: a.id, placement: 'below' }),
    ).toBeNull();
  });

  it('goes into the Folder of the row that it lands on', () => {
    const work = folder('Work');
    const inside = makeItem({ title: 'Inside', parentId: work.id, position: 0 });
    const other = makeItem({ title: 'Other', parentId: work.id, position: 1 });
    const loose = makeItem({ title: 'Loose', position: 5 });
    const nested = makeState({ items: [work, inside, other, loose] });

    expect(
      planDrop(nested, item(loose), { zone: 'tree-row', itemId: other.id, placement: 'above' }),
    ).toEqual({ type: 'item/move', itemId: loose.id, parentId: work.id, index: 1 });
  });

  it('goes to the end of a collapsed Folder when it lands inside', () => {
    const work = folder('Work', { collapsed: true });
    const loose = makeItem({ title: 'Loose' });
    const nested = makeState({ items: [work, loose] });

    expect(
      planDrop(nested, item(loose), { zone: 'tree-row', itemId: work.id, placement: 'inside' }),
    ).toEqual({ type: 'item/move', itemId: loose.id, parentId: work.id });
  });

  it('goes to the top of an open Folder when it lands inside', () => {
    const work = folder('Work');
    const loose = makeItem({ title: 'Loose' });
    const nested = makeState({ items: [work, loose] });

    expect(
      planDrop(nested, item(loose), { zone: 'tree-row', itemId: work.id, placement: 'inside' }),
    ).toEqual({ type: 'item/move', itemId: loose.id, parentId: work.id, index: 0 });
  });

  it('goes to the end of the root on the Pinned Tabs section', () => {
    expect(planDrop(state, item(a), { zone: 'pinned-root' })).toEqual({
      type: 'item/move',
      itemId: a.id,
      parentId: null,
    });
  });

  it('turns a Favorite into a Pinned Tab at the place of the row', () => {
    const fav = favorite('Fav', 0);
    const withFavorite = makeState({ items: [fav, a, b] });

    expect(
      planDrop(withFavorite, item(fav), { zone: 'tree-row', itemId: b.id, placement: 'above' }),
    ).toEqual({ type: 'item/move', itemId: fav.id, parentId: null, index: 1 });
  });
});

describe('a Folder dropped in the tree', () => {
  const work = folder('Work', { position: 0 });
  const inner = folder('Inner', { parentId: work.id, position: 0 });
  const deep = makeItem({ title: 'Deep', parentId: inner.id, position: 0 });
  const home = folder('Home', { position: 1 });
  const state = makeState({ items: [work, inner, deep, home] });

  it('moves inside another Folder', () => {
    expect(
      planDrop(state, item(home), { zone: 'tree-row', itemId: work.id, placement: 'inside' }),
    ).toEqual({ type: 'item/move', itemId: home.id, parentId: work.id, index: 0 });
  });

  it('is refused inside itself and inside its own content, whatever the place', () => {
    for (const row of [work, inner, deep]) {
      for (const placement of ['above', 'below', 'inside'] as const) {
        expect(
          planDrop(state, item(work), { zone: 'tree-row', itemId: row.id, placement }),
        ).toBeNull();
      }
    }
  });

  it('can still move above or below a row at its own level', () => {
    expect(
      planDrop(state, item(work), { zone: 'tree-row', itemId: home.id, placement: 'below' }),
    ).toEqual({ type: 'item/move', itemId: work.id, parentId: null, index: 1 });
  });

  it('is refused in the Favorites and in the Unpinned Tabs', () => {
    const targets: DropTarget[] = [
      { zone: 'favorites' },
      { zone: 'unpinned' },
      { zone: 'tab-row', tabId: 1, edge: 'above' },
    ];
    for (const target of targets) expect(planDrop(state, item(home), target)).toBeNull();
    const fav = favorite('Fav', 0);
    expect(
      planDrop(makeState({ items: [home, fav] }), item(home), {
        zone: 'favorite-tile',
        itemId: fav.id,
        edge: 'before',
      }),
    ).toBeNull();
  });
});

describe('an item dropped in the Favorites', () => {
  const f0 = favorite('F0', 0);
  const f1 = favorite('F1', 1);
  const f2 = favorite('F2', 2);
  const pinned = makeItem({ title: 'Pinned' });
  const state = makeState({ items: [f0, f1, f2, pinned] });

  it('makes a Pinned Tab a Favorite before or after a tile', () => {
    expect(
      planDrop(state, item(pinned), { zone: 'favorite-tile', itemId: f1.id, edge: 'before' }),
    ).toEqual({ type: 'item/favorite', itemId: pinned.id, index: 1 });
    expect(
      planDrop(state, item(pinned), { zone: 'favorite-tile', itemId: f1.id, edge: 'after' }),
    ).toEqual({ type: 'item/favorite', itemId: pinned.id, index: 2 });
  });

  it('puts a Pinned Tab at the end of the Favorites on the grid, as "Move to…" does', () => {
    expect(planDrop(state, item(pinned), { zone: 'favorites' })).toEqual({
      type: 'item/favorite',
      itemId: pinned.id,
    });
  });

  it('reorders a Favorite: the index counts the other Favorites', () => {
    expect(
      planDrop(state, item(f0), { zone: 'favorite-tile', itemId: f2.id, edge: 'after' }),
    ).toEqual({ type: 'item/favorite', itemId: f0.id, index: 2 });
    expect(
      planDrop(state, item(f2), { zone: 'favorite-tile', itemId: f0.id, edge: 'before' }),
    ).toEqual({ type: 'item/favorite', itemId: f2.id, index: 0 });
  });

  it('refuses a Favorite on itself, and on the grid gap', () => {
    expect(
      planDrop(state, item(f1), { zone: 'favorite-tile', itemId: f1.id, edge: 'after' }),
    ).toBeNull();
    expect(planDrop(state, item(f1), { zone: 'favorites' })).toBeNull();
  });
});

describe('an item dropped in the Unpinned Tabs', () => {
  const pinned = makeItem({ title: 'Pinned' });
  const fav = favorite('Fav', 0);
  const state = makeState({ items: [pinned, fav] });

  it('becomes an Unpinned Tab, from a Pinned Tab and from a Favorite', () => {
    expect(planDrop(state, item(pinned), { zone: 'unpinned' })).toEqual({
      type: 'item/unpin',
      itemId: pinned.id,
    });
    expect(planDrop(state, item(fav), { zone: 'unpinned' })).toEqual({
      type: 'item/unpin',
      itemId: fav.id,
    });
  });

  it('is the same wherever it lands in the list', () => {
    expect(planDrop(state, item(pinned), { zone: 'tab-row', tabId: 9, edge: 'below' })).toEqual({
      type: 'item/unpin',
      itemId: pinned.id,
    });
  });
});

describe('an Unpinned Tab dropped in the Pinned Tabs and the Favorites', () => {
  const dragged = makeTab();
  const a = makeItem({ title: 'A', position: 0 });
  const b = makeItem({ title: 'B', position: 1 });
  const work = folder('Work', { position: 2 });
  const f0 = favorite('F0', 0);
  const state = makeState({ unpinnedTabs: [dragged], items: [a, b, work, f0] });

  it('makes a Pinned Tab at the place of the row', () => {
    expect(
      planDrop(state, tab(dragged), { zone: 'tree-row', itemId: b.id, placement: 'above' }),
    ).toEqual({
      type: 'item/from-tab',
      tabId: dragged.id,
      kind: 'pinned',
      parentId: null,
      index: 1,
    });
    expect(
      planDrop(state, tab(dragged), { zone: 'tree-row', itemId: b.id, placement: 'below' }),
    ).toEqual({
      type: 'item/from-tab',
      tabId: dragged.id,
      kind: 'pinned',
      parentId: null,
      index: 2,
    });
  });

  it('makes a Pinned Tab inside a Folder', () => {
    expect(
      planDrop(state, tab(dragged), { zone: 'tree-row', itemId: work.id, placement: 'inside' }),
    ).toEqual({
      type: 'item/from-tab',
      tabId: dragged.id,
      kind: 'pinned',
      parentId: work.id,
      index: 0,
    });
  });

  it('makes a Pinned Tab at the end of the root on the section', () => {
    expect(planDrop(state, tab(dragged), { zone: 'pinned-root' })).toEqual({
      type: 'item/from-tab',
      tabId: dragged.id,
      kind: 'pinned',
      parentId: null,
    });
  });

  it('makes a Favorite before or after a tile, and at the end on the grid', () => {
    expect(
      planDrop(state, tab(dragged), { zone: 'favorite-tile', itemId: f0.id, edge: 'after' }),
    ).toEqual({
      type: 'item/from-tab',
      tabId: dragged.id,
      kind: 'favorite',
      parentId: null,
      index: 1,
    });
    expect(planDrop(state, tab(dragged), { zone: 'favorites' })).toEqual({
      type: 'item/from-tab',
      tabId: dragged.id,
      kind: 'favorite',
      parentId: null,
    });
  });

  it('is refused on the gap of the Unpinned Tabs', () => {
    expect(planDrop(state, tab(dragged), { zone: 'unpinned' })).toBeNull();
  });
});

describe('an Unpinned Tab reordered in the tab strip', () => {
  // Strip of window 1: t0 t1 t2 t3 t4, with t2 and t3 in a group. Window 2 has t5.
  const tabs = [0, 1, 2, 3, 4].map((i) => makeTab({ id: 100 + i, index: i, windowId: 1 }));
  const other = makeTab({ id: 105, index: 0, windowId: 2 });
  const group: TabGroupView = {
    id: 7,
    windowId: 1,
    title: 'G',
    color: 'blue',
    collapsed: false,
    tabIds: [102, 103],
  };
  const state = makeState({ unpinnedTabs: [...tabs, other], tabGroups: [group] });
  const [t0, t1, t2, t3, t4] = tabs as [TabView, TabView, TabView, TabView, TabView];
  const move = (source: TabView, row: TabView, edge: 'above' | 'below') =>
    planDrop(state, tab(source), { zone: 'tab-row', tabId: row.id, edge });

  it('moves down: the index is where the tab ends', () => {
    expect(move(t0, t1, 'below')).toEqual({ type: 'tab/move', tabId: t0.id, index: 1 });
    expect(move(t0, t4, 'above')).toEqual({ type: 'tab/move', tabId: t0.id, index: 3 });
  });

  it('moves up', () => {
    expect(move(t4, t0, 'above')).toEqual({ type: 'tab/move', tabId: t4.id, index: 0 });
    expect(move(t4, t0, 'below')).toEqual({ type: 'tab/move', tabId: t4.id, index: 1 });
  });

  it('is refused when the tab would not move', () => {
    expect(move(t1, t1, 'above')).toBeNull();
    expect(move(t1, t2, 'above')).toBeNull();
    expect(move(t1, t0, 'below')).toBeNull();
  });

  it('moves into the window of a row of another window, at the place of the row', () => {
    expect(move(t0, other, 'above')).toEqual({
      type: 'tab/move',
      tabId: t0.id,
      index: 0,
      targetWindowId: 2,
    });
    expect(move(t4, other, 'below')).toEqual({
      type: 'tab/move',
      tabId: t4.id,
      index: 1,
      targetWindowId: 2,
    });
  });

  it('leaves its Tab group when it moves to another window', () => {
    expect(move(t2, other, 'above')).toEqual({
      type: 'tab/move',
      tabId: t2.id,
      index: 0,
      groupId: null,
      targetWindowId: 2,
    });
  });

  it('joins the Tab group of the other window when it lands between two of its tabs', () => {
    const second = makeTab({ id: 106, index: 1, windowId: 2 });
    const inOther: TabGroupView = {
      id: 8,
      windowId: 2,
      title: 'H',
      color: 'red',
      collapsed: false,
      tabIds: [other.id, second.id],
    };
    const crossState = makeState({
      unpinnedTabs: [...tabs, other, second],
      tabGroups: [group, inOther],
    });

    expect(
      planDrop(crossState, tab(t0), { zone: 'tab-row', tabId: second.id, edge: 'above' }),
    ).toEqual({ type: 'tab/move', tabId: t0.id, index: 1, groupId: 8, targetWindowId: 2 });
  });

  it('joins the group when it lands between two tabs of the group', () => {
    expect(move(t0, t3, 'above')).toEqual({
      type: 'tab/move',
      tabId: t0.id,
      index: 2,
      groupId: 7,
    });
    expect(move(t4, t2, 'below')).toEqual({
      type: 'tab/move',
      tabId: t4.id,
      index: 3,
      groupId: 7,
    });
  });

  it('stays out of the group when it lands before the first tab or after the last tab of the group', () => {
    expect(move(t0, t2, 'above')).toEqual({ type: 'tab/move', tabId: t0.id, index: 1 });
    expect(move(t0, t3, 'below')).toEqual({ type: 'tab/move', tabId: t0.id, index: 3 });
  });

  it('leaves the group when it lands outside of it', () => {
    expect(move(t3, t4, 'below')).toEqual({
      type: 'tab/move',
      tabId: t3.id,
      index: 4,
      groupId: null,
    });
    expect(move(t2, t0, 'above')).toEqual({
      type: 'tab/move',
      tabId: t2.id,
      index: 0,
      groupId: null,
    });
  });

  it('keeps its group when it lands on a row of that group, also at the edge of the group', () => {
    expect(move(t2, t3, 'below')).toEqual({ type: 'tab/move', tabId: t2.id, index: 3 });
    expect(move(t3, t2, 'above')).toEqual({ type: 'tab/move', tabId: t3.id, index: 2 });
  });
});

describe('an Unpinned Tab dropped on a Tab group', () => {
  const inGroup = makeTab({ id: 201, index: 0 });
  const outside = makeTab({ id: 202, index: 1 });
  const elsewhere = makeTab({ id: 203, index: 0, windowId: 2 });
  const group: TabGroupView = {
    id: 9,
    windowId: 1,
    title: 'G',
    color: 'red',
    collapsed: true,
    tabIds: [201],
  };
  const state = makeState({ unpinnedTabs: [inGroup, outside, elsewhere], tabGroups: [group] });

  it('joins the group, as "Move to…" does', () => {
    expect(planDrop(state, tab(outside), { zone: 'tab-group', groupId: 9 })).toEqual({
      type: 'group/add-tab',
      tabId: outside.id,
      groupId: 9,
    });
  });

  it('is refused for a tab that already is in the group, and for a tab of another window', () => {
    expect(planDrop(state, tab(inGroup), { zone: 'tab-group', groupId: 9 })).toBeNull();
    expect(planDrop(state, tab(elsewhere), { zone: 'tab-group', groupId: 9 })).toBeNull();
  });
});

describe('the same command as the "Move to…" action', () => {
  const target = (targets: ReturnType<typeof itemMoveTargets>, key: string) =>
    targets.find((entry) => entry.key === key)?.command;

  const work = folder('Work', { collapsed: true, position: 0 });
  const mail = makeItem({ title: 'Mail', position: 1 });
  const inWork = makeItem({ title: 'Inside', parentId: work.id, position: 0 });
  const fav = favorite('Fav', 0);
  const state = makeState({ items: [work, mail, inWork, fav] });

  it('moves a Pinned Tab into a collapsed Folder', () => {
    expect(
      planDrop(state, item(mail), { zone: 'tree-row', itemId: work.id, placement: 'inside' }),
    ).toEqual(target(itemMoveTargets(state.items, mail), work.id));
  });

  it('moves a Pinned Tab to the end of the Favorites', () => {
    expect(planDrop(state, item(mail), { zone: 'favorites' })).toEqual(
      target(itemMoveTargets(state.items, mail), 'favorites'),
    );
  });

  it('moves a Pinned Tab out of a Folder to the root', () => {
    expect(planDrop(state, item(inWork), { zone: 'pinned-root' })).toEqual(
      target(itemMoveTargets(state.items, inWork), 'root'),
    );
  });

  it('moves a Favorite to the root', () => {
    expect(planDrop(state, item(fav), { zone: 'pinned-root' })).toEqual(
      target(itemMoveTargets(state.items, fav), 'root'),
    );
  });

  it('makes a Pinned Tab and a Favorite an Unpinned Tab', () => {
    for (const source of [mail, fav]) {
      expect(planDrop(state, item(source), { zone: 'unpinned' })).toEqual(
        target(itemMoveTargets(state.items, source), 'unpinned'),
      );
    }
  });

  it('puts an Unpinned Tab in a Tab group', () => {
    const dragged = makeTab();
    const group: TabGroupView = {
      id: 4,
      windowId: dragged.windowId,
      title: 'G',
      color: 'blue',
      collapsed: false,
      tabIds: [],
    };
    const tabState = makeState({ unpinnedTabs: [dragged], tabGroups: [group] });

    expect(planDrop(tabState, tab(dragged), { zone: 'tab-group', groupId: 4 })).toEqual(
      tabMoveTargets([group], dragged).find((entry) => entry.key === 'group-4')?.command,
    );
  });
});

it('refuses a source that is no longer in the state', () => {
  const state = makeState();
  expect(planDrop(state, { type: 'item', itemId: 'gone' }, { zone: 'pinned-root' })).toBeNull();
  expect(planDrop(state, { type: 'tab', tabId: 99 }, { zone: 'pinned-root' })).toBeNull();
});
