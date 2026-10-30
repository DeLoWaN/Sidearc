import type { TabGroupView, TabView } from '../shared/types';

/** One line of the Unpinned Tabs: a tab outside of all groups, or a Tab group with its listed tabs. */
export type UnpinnedEntry =
  | { kind: 'tab'; tab: TabView }
  | { kind: 'group'; group: TabGroupView; tabs: TabView[] };

/**
 * Puts the tabs of each Tab group in one block, where the first tab of the group is.
 * A group without a listed tab gets no block.
 */
export function arrangeUnpinned(tabs: TabView[], groups: TabGroupView[]): UnpinnedEntry[] {
  const groupOf = (tab: TabView) => groups.find((group) => group.tabIds.includes(tab.id));
  const entries: UnpinnedEntry[] = [];
  const placed = new Set<number>();
  for (const tab of tabs) {
    const group = groupOf(tab);
    if (!group) {
      entries.push({ kind: 'tab', tab });
    } else if (!placed.has(group.id)) {
      placed.add(group.id);
      entries.push({
        kind: 'group',
        group,
        tabs: tabs.filter((other) => groupOf(other) === group),
      });
    }
  }
  return entries;
}
