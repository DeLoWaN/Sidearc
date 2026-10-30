import { describe, expect, it } from 'vitest';
import { makeItem, makeState, makeTab } from '../../../tests/support/builders';
import type { SiteGroupView, TabGroupView, TabView } from '../../shared/types';
import { planDrop } from './plan-drop';
import { planGroupStep } from './plan-group';
import type { DropTarget, GroupRef } from './types';

/** A tab with a fixed id, so that a test reads like the tab strip. */
const tabAt = (id: number, index: number, windowId = 1): TabView =>
  makeTab({ id, index, windowId, title: `T${id}` });

const tabGroup = (id: number, tabs: TabView[], windowId = 1): TabGroupView => ({
  id,
  windowId,
  title: `G${id}`,
  color: 'blue',
  collapsed: false,
  tabIds: tabs.map((tab) => tab.id),
});

const siteGroup = (id: string, tabs: TabView[]): SiteGroupView => ({
  id,
  host: `${id}.test`,
  name: null,
  tabIds: tabs.map((tab) => tab.id),
  collapsed: false,
});

/** The tabs of window 1 at the indexes 0 to count - 1, with the ids 1 to count. */
const strip = (count: number) => Array.from({ length: count }, (_, i) => tabAt(i + 1, i));

const tabSource = (groupId: number): GroupRef => ({ kind: 'tab', groupId });
const siteSource = (groupId: string): GroupRef => ({ kind: 'site', groupId });
const drag = (group: GroupRef) => ({ type: 'group' as const, ...group });
const row = (tab: TabView, edge: 'above' | 'below'): DropTarget => ({
  zone: 'tab-row',
  tabId: tab.id,
  edge,
});
const edgeOf = (group: GroupRef, edge: 'above' | 'below'): DropTarget => ({
  zone: 'group-edge',
  group,
  edge,
});

describe('a Tab group dropped on a tab row', () => {
  // Strip: a0 [b1 c2] d3 e4 f5
  const [a, b, c, d, e, f] = strip(6) as [TabView, TabView, TabView, TabView, TabView, TabView];
  const state = makeState({ unpinnedTabs: [a, b, c, d, e, f], tabGroups: [tabGroup(100, [b, c])] });
  const source = drag(tabSource(100));

  it('goes below a tab after it: the index drops by the size of the group', () => {
    expect(planDrop(state, source, row(d, 'below'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 2,
      targetWindowId: 1,
    });
    expect(planDrop(state, source, row(f, 'below'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 4,
      targetWindowId: 1,
    });
  });

  it('goes above a tab before it: the index stays', () => {
    expect(planDrop(state, source, row(a, 'above'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 0,
      targetWindowId: 1,
    });
  });

  it('goes above a tab that follows it: the index drops by the size of the group', () => {
    expect(planDrop(state, source, row(e, 'above'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 2,
      targetWindowId: 1,
    });
  });

  it('is refused where the group already sits', () => {
    expect(planDrop(state, source, row(a, 'below'))).toBeNull();
    expect(planDrop(state, source, row(d, 'above'))).toBeNull();
  });

  it('goes to another window at the place of the row, with no shift', () => {
    const x = tabAt(20, 0, 2);
    const y = tabAt(21, 1, 2);
    const two = makeState({
      unpinnedTabs: [a, b, c, x, y],
      tabGroups: [tabGroup(100, [b, c])],
    });

    expect(planDrop(two, source, row(y, 'below'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 2,
      targetWindowId: 2,
    });
    expect(planDrop(two, source, row(x, 'above'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 0,
      targetWindowId: 2,
    });
  });

  it('finds the place of the group when a live tab hides its first tab', () => {
    // Strip: a0 [live1 b2 c3] d4. The panel does not list the live tab.
    const [a0, b2, c3, d4] = [tabAt(1, 0), tabAt(2, 2), tabAt(3, 3), tabAt(4, 4)] as [
      TabView,
      TabView,
      TabView,
      TabView,
    ];
    const hidden = makeState({
      unpinnedTabs: [a0, b2, c3, d4],
      tabGroups: [{ ...tabGroup(100, [b2, c3]), tabIds: [99, 2, 3] }],
    });

    expect(planDrop(hidden, source, row(d4, 'below'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 2,
      targetWindowId: 1,
    });
    expect(planDrop(hidden, source, row(a0, 'below'))).toBeNull();
  });

  it('is refused on a tab that is a member of a group', () => {
    expect(planDrop(state, source, row(b, 'above'))).toBeNull();
    expect(planDrop(state, drag(tabSource(100)), row(c, 'below'))).toBeNull();
  });

  it('is refused when the group or the row does not exist', () => {
    expect(planDrop(state, drag(tabSource(404)), row(a, 'above'))).toBeNull();
    expect(planDrop(state, source, { zone: 'tab-row', tabId: 404, edge: 'above' })).toBeNull();
  });
});

describe('a Tab group dropped on another block', () => {
  // Strip: a0 [b1 c2] d3 [e4 f5] g6
  const [a, b, c, d, e, f, g] = strip(7) as [
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: [a, b, c, d, e, f, g],
    tabGroups: [tabGroup(100, [b, c]), tabGroup(200, [e, f])],
    siteGroups: [],
  });
  const source = drag(tabSource(100));

  it('goes below a Tab group, after its last tab', () => {
    expect(planDrop(state, source, edgeOf(tabSource(200), 'below'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 4,
      targetWindowId: 1,
    });
  });

  it('goes above a Tab group, before its first tab', () => {
    expect(planDrop(state, source, edgeOf(tabSource(200), 'above'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 2,
      targetWindowId: 1,
    });
    expect(planDrop(state, drag(tabSource(200)), edgeOf(tabSource(100), 'above'))).toEqual({
      type: 'group/move',
      groupId: 200,
      index: 1,
      targetWindowId: 1,
    });
  });

  it('is refused on its own block', () => {
    expect(planDrop(state, source, edgeOf(tabSource(100), 'above'))).toBeNull();
    expect(planDrop(state, source, edgeOf(tabSource(100), 'below'))).toBeNull();
  });

  it('goes next to a site group, which is treated as one block', () => {
    const withSite = makeState({
      unpinnedTabs: [a, b, c, d, e, f, g],
      tabGroups: [tabGroup(100, [b, c])],
      siteGroups: [siteGroup('docs', [e, f])],
    });

    expect(planDrop(withSite, source, edgeOf(siteSource('docs'), 'below'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 4,
      targetWindowId: 1,
    });
    expect(planDrop(withSite, source, edgeOf(siteSource('docs'), 'above'))).toEqual({
      type: 'group/move',
      groupId: 100,
      index: 2,
      targetWindowId: 1,
    });
  });

  it('is refused on a block that does not exist', () => {
    expect(planDrop(state, source, edgeOf(tabSource(404), 'above'))).toBeNull();
    expect(planDrop(state, source, edgeOf(siteSource('nope'), 'above'))).toBeNull();
  });
});

describe('a Tab group dropped at the end of the Unpinned Tabs', () => {
  it('goes to the end of the last window', () => {
    const [a, b, c] = [tabAt(1, 0), tabAt(2, 1), tabAt(3, 2)] as [TabView, TabView, TabView];
    const x = tabAt(20, 0, 2);
    const state = makeState({ unpinnedTabs: [a, b, c, x], tabGroups: [tabGroup(100, [b, c])] });

    expect(planDrop(state, drag(tabSource(100)), { zone: 'unpinned' })).toEqual({
      type: 'group/move',
      groupId: 100,
      index: -1,
      targetWindowId: 2,
    });
  });

  it('is refused when the group already ends the list', () => {
    const [a, b, c] = [tabAt(1, 0), tabAt(2, 1), tabAt(3, 2)] as [TabView, TabView, TabView];
    const state = makeState({ unpinnedTabs: [a, b, c], tabGroups: [tabGroup(100, [b, c])] });

    expect(planDrop(state, drag(tabSource(100)), { zone: 'unpinned' })).toBeNull();
  });
});

describe('a Site group dropped on a tab row', () => {
  // Strip: a0 [d1 b2 e3] c4 f5 (the site group holds d and e, with b between them)
  const [a, d, b, e, c, f] = [
    tabAt(1, 0),
    tabAt(4, 1),
    tabAt(2, 2),
    tabAt(5, 3),
    tabAt(3, 4),
    tabAt(6, 5),
  ] as [TabView, TabView, TabView, TabView, TabView, TabView];
  const state = makeState({
    unpinnedTabs: [a, d, b, e, c, f],
    siteGroups: [siteGroup('docs', [d, e])],
  });
  const source = drag(siteSource('docs'));

  it('goes below a tab after its members: the index drops by the members before it', () => {
    expect(planDrop(state, source, row(c, 'below'))).toEqual({
      type: 'site-group/move',
      groupId: 'docs',
      index: 3,
      targetWindowId: 1,
    });
    expect(planDrop(state, source, row(f, 'below'))).toEqual({
      type: 'site-group/move',
      groupId: 'docs',
      index: 4,
      targetWindowId: 1,
    });
  });

  it('goes above a tab before its members: the index stays', () => {
    expect(planDrop(state, source, row(a, 'above'))).toEqual({
      type: 'site-group/move',
      groupId: 'docs',
      index: 0,
      targetWindowId: 1,
    });
  });

  it('gathers members that sit apart, also when the drop is next to them', () => {
    expect(planDrop(state, source, row(b, 'below'))).toEqual({
      type: 'site-group/move',
      groupId: 'docs',
      index: 2,
      targetWindowId: 1,
    });
  });

  it('is refused when the members already sit together at that place', () => {
    const [a0, d1, e2, x3, c4, f5] = [
      tabAt(1, 0),
      tabAt(4, 1),
      tabAt(5, 2),
      tabAt(2, 3),
      tabAt(3, 4),
      tabAt(6, 5),
    ] as [TabView, TabView, TabView, TabView, TabView, TabView];
    const placed = makeState({
      unpinnedTabs: [a0, d1, e2, x3, c4, f5],
      siteGroups: [siteGroup('docs', [d1, e2])],
    });

    expect(planDrop(placed, source, row(a0, 'below'))).toBeNull();
    expect(planDrop(placed, source, row(x3, 'above'))).toBeNull();
  });

  it('brings the members of another window to the window of the row', () => {
    // Window 1: w0 m1. Window 2: m2 y z.
    const [w, m1] = [tabAt(30, 0, 1), tabAt(31, 1, 1)] as [TabView, TabView];
    const [m2, y, z] = [tabAt(32, 0, 2), tabAt(21, 1, 2), tabAt(22, 2, 2)] as [
      TabView,
      TabView,
      TabView,
    ];
    const two = makeState({
      unpinnedTabs: [w, m1, m2, y, z],
      siteGroups: [siteGroup('docs', [m1, m2])],
    });

    // m2 leaves its place before the drop place, so the index drops by one.
    expect(planDrop(two, source, row(z, 'below'))).toEqual({
      type: 'site-group/move',
      groupId: 'docs',
      index: 2,
      targetWindowId: 2,
    });
    expect(planDrop(two, source, row(w, 'above'))).toEqual({
      type: 'site-group/move',
      groupId: 'docs',
      index: 0,
      targetWindowId: 1,
    });
  });

  it('is refused for a group that does not exist', () => {
    expect(planDrop(state, drag(siteSource('nope')), row(a, 'above'))).toBeNull();
  });
});

describe('a Site group dropped on a block or at the end', () => {
  // Strip: a0 [b1 c2] d3 [e4 f5] g6
  const [a, b, c, d, e, f, g] = strip(7) as [
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: [a, b, c, d, e, f, g],
    tabGroups: [tabGroup(100, [b, c])],
    siteGroups: [siteGroup('docs', [e, f])],
  });
  const source = drag(siteSource('docs'));

  it('goes above and below a Tab group as one unit', () => {
    expect(planDrop(state, source, edgeOf(tabSource(100), 'above'))).toEqual({
      type: 'site-group/move',
      groupId: 'docs',
      index: 1,
      targetWindowId: 1,
    });
    expect(planDrop(state, source, edgeOf(tabSource(100), 'below'))).toEqual({
      type: 'site-group/move',
      groupId: 'docs',
      index: 3,
      targetWindowId: 1,
    });
  });

  it('is refused on its own block', () => {
    expect(planDrop(state, source, edgeOf(siteSource('docs'), 'above'))).toBeNull();
    expect(planDrop(state, source, edgeOf(siteSource('docs'), 'below'))).toBeNull();
  });

  it('goes to the end of the list', () => {
    expect(planDrop(state, source, { zone: 'unpinned' })).toEqual({
      type: 'site-group/move',
      groupId: 'docs',
      index: -1,
      targetWindowId: 1,
    });
  });

  it('is refused at the end when its members already end the list', () => {
    const tail = makeState({
      unpinnedTabs: [a, b, c, d, tabAt(5, 4), tabAt(6, 5)],
      siteGroups: [siteGroup('docs', [tabAt(5, 4), tabAt(6, 5)])],
    });

    expect(planDrop(tail, source, { zone: 'unpinned' })).toBeNull();
  });
});

describe('a group dropped where it cannot go', () => {
  const [a, b, c] = [tabAt(1, 0), tabAt(2, 1), tabAt(3, 2)] as [TabView, TabView, TabView];
  const folder = makeItem({ kind: 'folder', url: '', title: 'Work' });
  const pinned = makeItem({ title: 'Mail' });
  const state = makeState({
    unpinnedTabs: [a, b, c],
    items: [folder, pinned],
    tabGroups: [tabGroup(100, [b, c])],
    siteGroups: [],
  });
  const refused: [string, DropTarget][] = [
    ['the Pinned Tabs section', { zone: 'pinned-root' }],
    ['a Folder', { zone: 'tree-row', itemId: folder.id, placement: 'inside' }],
    ['a Pinned Tab', { zone: 'tree-row', itemId: pinned.id, placement: 'above' }],
    ['the Favorites', { zone: 'favorites' }],
    ['a Favorite', { zone: 'favorite-tile', itemId: pinned.id, edge: 'before' }],
    ['a Tab group as a place to join', { zone: 'tab-group', groupId: 100 }],
  ];

  it.each(refused)('is refused on %s', (_name, target) => {
    expect(planDrop(state, drag(tabSource(100)), target)).toBeNull();
    expect(planDrop(state, drag(siteSource('docs')), target)).toBeNull();
  });
});

describe('the keyboard step of a group', () => {
  // Strip: a0 [b1 c2] d3 [e4 f5] g6
  const [a, b, c, d, e, f, g] = strip(7) as [
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
    TabView,
  ];
  const state = makeState({
    unpinnedTabs: [a, b, c, d, e, f, g],
    tabGroups: [tabGroup(100, [b, c])],
    siteGroups: [siteGroup('docs', [e, f])],
  });

  it('moves a group above the previous tab and below the next tab', () => {
    expect(planGroupStep(state, tabSource(100))).toEqual({
      up: { type: 'group/move', groupId: 100, index: 0, targetWindowId: 1 },
      down: { type: 'group/move', groupId: 100, index: 2, targetWindowId: 1 },
    });
  });

  it('moves a group above the previous block and below the next block', () => {
    expect(planGroupStep(state, siteSource('docs'))).toEqual({
      up: { type: 'site-group/move', groupId: 'docs', index: 3, targetWindowId: 1 },
      down: { type: 'site-group/move', groupId: 'docs', index: 5, targetWindowId: 1 },
    });
  });

  it('has no step up for the first entry and no step down for the last one', () => {
    const [x, y, z] = [tabAt(2, 0), tabAt(3, 1), tabAt(1, 2)] as [TabView, TabView, TabView];
    const first = makeState({ unpinnedTabs: [x, y, z], tabGroups: [tabGroup(100, [x, y])] });
    const last = makeState({ unpinnedTabs: [a, b, c], tabGroups: [tabGroup(100, [b, c])] });

    expect(planGroupStep(first, tabSource(100)).up).toBeNull();
    expect(planGroupStep(first, tabSource(100)).down).not.toBeNull();
    expect(planGroupStep(last, tabSource(100)).down).toBeNull();
    expect(planGroupStep(last, tabSource(100)).up).not.toBeNull();
  });

  it('gives no step for a group that the list does not show', () => {
    expect(planGroupStep(state, tabSource(404))).toEqual({ up: null, down: null });
  });
});
