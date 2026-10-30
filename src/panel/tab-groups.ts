import type { SiteGroupView, TabGroupView, TabView } from '../shared/types';

/** One line of the Unpinned Tabs: a loose tab, or a Tab group or a site group with its listed tabs. */
export type UnpinnedEntry =
  | { kind: 'tab'; tab: TabView }
  | { kind: 'group'; group: TabGroupView; tabs: TabView[] }
  | { kind: 'site-group'; group: SiteGroupView; tabs: TabView[] };

type Group = TabGroupView | SiteGroupView;

/**
 * Puts the tabs of each group in one block, where the first listed tab of the group is.
 * A Tab group wins over a site group for a tab that is in both.
 * A group without a listed tab gets no block.
 */
export function arrangeUnpinned(
  tabs: TabView[],
  groups: TabGroupView[],
  siteGroups: SiteGroupView[] = [],
): UnpinnedEntry[] {
  const groupOf = (tab: TabView) => groups.find((group) => group.tabIds.includes(tab.id));
  const siteGroupOf = (tab: TabView) =>
    groupOf(tab) ? undefined : siteGroups.find((group) => group.tabIds.includes(tab.id));
  const entries: UnpinnedEntry[] = [];
  const placed = new Set<Group>();
  for (const tab of tabs) {
    const group = groupOf(tab);
    const siteGroup = siteGroupOf(tab);
    if (group && !placed.has(group)) {
      placed.add(group);
      entries.push({
        kind: 'group',
        group,
        tabs: tabs.filter((other) => groupOf(other) === group),
      });
    } else if (siteGroup && !placed.has(siteGroup)) {
      placed.add(siteGroup);
      // The block lists all members at the first member, even when another tab sits between them in the strip.
      entries.push({
        kind: 'site-group',
        group: siteGroup,
        tabs: tabs.filter((other) => siteGroupOf(other) === siteGroup),
      });
    } else if (!group && !siteGroup) {
      entries.push({ kind: 'tab', tab });
    }
  }
  return entries;
}
