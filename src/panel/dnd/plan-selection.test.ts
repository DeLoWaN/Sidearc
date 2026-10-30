import { describe, expect, it } from 'vitest';
import { makeItem, makeState, makeTab } from '../../../tests/support/builders';
import type { ItemView, SiteGroupView, TabGroupView } from '../../shared/types';
import { selectionMoveTargets } from '../move-targets';
import { planDrop } from './plan-drop';
import type { DragSource } from './types';

const folder = (title: string, overrides: Partial<ItemView> = {}) =>
  makeItem({ kind: 'folder', url: '', title, ...overrides });

const selection = (itemIds: string[] = [], tabIds: number[] = []): DragSource => ({
  type: 'selection',
  tabIds,
  itemIds,
});

describe('a selection dropped in the Pinned Tabs tree', () => {
  const a = makeItem({ title: 'A', position: 0 });
  const b = makeItem({ title: 'B', position: 1 });
  const c = makeItem({ title: 'C', position: 2 });
  const d = makeItem({ title: 'D', position: 3 });
  const state = makeState({ items: [a, b, c, d] });

  it('goes below a row: the index counts the siblings without all the selected items', () => {
    expect(
      planDrop(state, selection([a.id, c.id]), {
        zone: 'tree-row',
        itemId: d.id,
        placement: 'below',
      }),
    ).toEqual({
      type: 'selection/move',
      tabIds: [],
      itemIds: [a.id, c.id],
      target: { kind: 'pinned', parentId: null, index: 2 },
    });
  });

  it('goes above a row', () => {
    expect(
      planDrop(state, selection([c.id, d.id]), {
        zone: 'tree-row',
        itemId: b.id,
        placement: 'above',
      }),
    ).toMatchObject({ target: { kind: 'pinned', parentId: null, index: 1 } });
  });

  it('is refused on one of its own rows', () => {
    expect(
      planDrop(state, selection([a.id, c.id]), {
        zone: 'tree-row',
        itemId: c.id,
        placement: 'above',
      }),
    ).toBeNull();
  });

  it('carries Unpinned Tabs with the items', () => {
    const t = makeTab();
    expect(
      planDrop(state, selection([a.id], [t.id]), {
        zone: 'tree-row',
        itemId: d.id,
        placement: 'below',
      }),
    ).toMatchObject({ tabIds: [t.id], itemIds: [a.id], target: { index: 3 } });
  });

  it('goes to the top of an open Folder and to the end of a collapsed one when it lands inside', () => {
    const open = folder('Open');
    const shut = folder('Shut', { collapsed: true });
    const nested = makeState({ items: [a, b, open, shut] });

    expect(
      planDrop(nested, selection([a.id, b.id]), {
        zone: 'tree-row',
        itemId: open.id,
        placement: 'inside',
      }),
    ).toMatchObject({ target: { kind: 'pinned', parentId: open.id, index: 0 } });
    const toShut = planDrop(nested, selection([a.id, b.id]), {
      zone: 'tree-row',
      itemId: shut.id,
      placement: 'inside',
    });
    expect(toShut).toMatchObject({ target: { kind: 'pinned', parentId: shut.id } });
    expect(toShut).not.toHaveProperty('target.index');
  });

  it('goes to the end of the root when it lands on the section', () => {
    expect(planDrop(state, selection([a.id, b.id]), { zone: 'pinned-root' })).toMatchObject({
      target: { kind: 'pinned', parentId: null },
    });
  });

  it('is refused inside a selected Folder, inside its content and on its own row', () => {
    const work = folder('Work');
    const inside = makeItem({ title: 'Inside', parentId: work.id });
    const sub = folder('Sub', { parentId: work.id });
    const nested = makeState({ items: [work, inside, sub, a] });
    const drag = selection([work.id, a.id]);

    for (const itemId of [work.id, inside.id, sub.id]) {
      for (const placement of ['above', 'below', 'inside'] as const) {
        expect(planDrop(nested, drag, { zone: 'tree-row', itemId, placement })).toBeNull();
      }
    }
  });

  it('is refused on the Favorites', () => {
    const fav = makeItem({ kind: 'favorite', title: 'Fav', position: 0 });
    const withFavorite = makeState({ items: [fav, a, b] });

    expect(
      planDrop(withFavorite, selection([a.id, b.id]), {
        zone: 'favorite-tile',
        itemId: fav.id,
        edge: 'after',
      }),
    ).toBeNull();
    expect(planDrop(withFavorite, selection([a.id, b.id]), { zone: 'favorites' })).toBeNull();
  });
});

describe('a selection dropped in the Unpinned Tabs', () => {
  const a = makeItem({ title: 'A', position: 0 });
  const work = folder('Work', { position: 1 });
  const t = makeTab();
  const state = makeState({ items: [a, work], unpinnedTabs: [t] });

  it('unpins the Pinned Tabs and leaves the tabs', () => {
    expect(planDrop(state, selection([a.id], [t.id]), { zone: 'unpinned' })).toEqual({
      type: 'selection/move',
      tabIds: [t.id],
      itemIds: [a.id],
      target: { kind: 'unpinned' },
    });
  });

  it('is refused when the selection holds a Folder', () => {
    expect(planDrop(state, selection([a.id, work.id]), { zone: 'unpinned' })).toBeNull();
  });

  it('is refused when the selection holds Unpinned Tabs only', () => {
    expect(planDrop(state, selection([], [t.id]), { zone: 'unpinned' })).toBeNull();
  });
});

describe('a selection dropped on a group', () => {
  const a = makeItem({ title: 'A' });
  const t1 = makeTab();
  const t2 = makeTab();
  const t3 = makeTab();
  const tabGroup: TabGroupView = {
    id: 7,
    windowId: 1,
    title: 'Work',
    color: 'blue',
    collapsed: false,
    tabIds: [t3.id],
  };
  const siteGroup: SiteGroupView = {
    id: 'site-1',
    host: 'docs.test',
    name: null,
    tabIds: [t3.id],
    collapsed: false,
  };
  const state = makeState({
    items: [a],
    unpinnedTabs: [t1, t2, t3],
    tabGroups: [tabGroup],
    siteGroups: [siteGroup],
  });

  it('joins a Tab group, tabs only', () => {
    expect(
      planDrop(state, selection([], [t1.id, t2.id]), { zone: 'tab-group', groupId: 7 }),
    ).toEqual({
      type: 'selection/move',
      tabIds: [t1.id, t2.id],
      itemIds: [],
      target: { kind: 'tab-group', groupId: 7 },
    });
    expect(
      planDrop(state, selection([a.id], [t1.id]), { zone: 'tab-group', groupId: 7 }),
    ).toBeNull();
  });

  it('joins a site group, tabs only', () => {
    expect(
      planDrop(state, selection([], [t1.id]), { zone: 'site-group', groupId: 'site-1' }),
    ).toMatchObject({ target: { kind: 'site-group', groupId: 'site-1' } });
    expect(
      planDrop(state, selection([a.id], [t1.id]), { zone: 'site-group', groupId: 'site-1' }),
    ).toBeNull();
  });

  it('is refused when every tab is a member already', () => {
    expect(planDrop(state, selection([], [t3.id]), { zone: 'tab-group', groupId: 7 })).toBeNull();
    expect(
      planDrop(state, selection([], [t3.id]), { zone: 'site-group', groupId: 'site-1' }),
    ).toBeNull();
  });
});

describe('the "Move to…" targets of a selection', () => {
  const a = makeItem({ title: 'A', position: 0 });
  const work = folder('Work', { position: 1 });
  const inside = makeItem({ title: 'Inside', parentId: work.id, position: 0 });
  const sub = folder('Sub', { parentId: work.id, position: 1 });
  const home = folder('Home', { position: 2 });
  const t1 = makeTab();
  const group: TabGroupView = {
    id: 3,
    windowId: 1,
    title: 'Reading',
    color: 'red',
    collapsed: false,
    tabIds: [],
  };
  const siteGroup: SiteGroupView = {
    id: 'site-1',
    host: 'docs.test',
    name: 'Docs',
    tabIds: [],
    collapsed: false,
  };
  const state = makeState({
    items: [a, work, inside, sub, home],
    unpinnedTabs: [t1],
    tabGroups: [group],
    siteGroups: [siteGroup],
  });
  const labels = (rows: { itemIds?: string[]; tabIds?: number[] }) =>
    selectionMoveTargets(state, { itemIds: rows.itemIds ?? [], tabIds: rows.tabIds ?? [] }).map(
      (target) => target.label,
    );

  it('lists the Folders in tree order and the Unpinned Tabs for a Pinned Tab, and no group', () => {
    expect(labels({ itemIds: [a.id] })).toEqual(['Work', 'Sub', 'Home', 'Unpinned Tabs']);
  });

  it('lists the groups for Unpinned Tabs and leaves out the Unpinned Tabs', () => {
    expect(labels({ tabIds: [t1.id] })).toEqual([
      'Pinned Tabs',
      'Work',
      'Sub',
      'Home',
      'Reading',
      'Docs',
    ]);
  });

  it('leaves out a selected Folder, its content, and the Unpinned Tabs', () => {
    expect(labels({ itemIds: [work.id] })).toEqual(['Home']);
  });

  it('leaves out the place where every selected item already is', () => {
    expect(labels({ itemIds: [inside.id] })).toEqual([
      'Pinned Tabs',
      'Sub',
      'Home',
      'Unpinned Tabs',
    ]);
  });

  it('sends the command that the drop on the same place sends', () => {
    const rows = { itemIds: [a.id], tabIds: [t1.id] };
    const byLabel = (label: string) =>
      selectionMoveTargets(state, rows).find((target) => target.label === label)?.command;

    expect(byLabel('Pinned Tabs')).toEqual(
      planDrop(state, { type: 'selection', ...rows }, { zone: 'pinned-root' }),
    );
    expect(byLabel('Unpinned Tabs')).toEqual(
      planDrop(state, { type: 'selection', ...rows }, { zone: 'unpinned' }),
    );
  });

  it('is empty when no place fits', () => {
    expect(selectionMoveTargets(state, { itemIds: [work.id, home.id], tabIds: [] })).toEqual([]);
  });
});
