import type { SidebarState, TabView } from '../../shared/types';
import { moveGroupCommand } from '../commands';
import type { CommandBody } from '../connection';
import { arrangeUnpinned, type UnpinnedEntry } from '../tab-groups';
import type { DropTarget, GroupRef } from './types';

/** A place in a tab strip: the window, and the index before the move. `end` is after the last tab. */
interface Place {
  windowId: number;
  at: number | 'end';
}

/** The rows that the Tab group takes in its strip. The first tab can be a live tab, which the panel does not list. */
interface TabGroupSpan {
  windowId: number;
  start: number;
  size: number;
}

type TabGroupRef = Extract<GroupRef, { kind: 'tab' }>;
type SiteGroupRef = Extract<GroupRef, { kind: 'site' }>;

const sameGroup = (a: GroupRef, b: GroupRef) => a.kind === b.kind && a.groupId === b.groupId;

const byStrip = (a: TabView, b: TabView) => a.windowId - b.windowId || a.index - b.index;

function tabGroupSpan(state: SidebarState, groupId: number): TabGroupSpan | undefined {
  const group = state.tabGroups.find((candidate) => candidate.id === groupId);
  if (!group) return undefined;
  // The tabs of a Tab group sit next to each other, so one listed tab fixes the start.
  const listed = group.tabIds
    .map((id) => state.unpinnedTabs.find((tab) => tab.id === id))
    .find((tab) => tab !== undefined);
  if (!listed) return undefined;
  const offset = group.tabIds.indexOf(listed.id);
  return { windowId: group.windowId, start: listed.index - offset, size: group.tabIds.length };
}

/** The member tabs of a site group in tab strip order. */
function siteMembers(state: SidebarState, groupId: string): TabView[] {
  const group = state.siteGroups.find((candidate) => candidate.id === groupId);
  return (group?.tabIds ?? [])
    .flatMap((id) => state.unpinnedTabs.filter((tab) => tab.id === id))
    .sort(byStrip);
}

/** The place above or below a group block. A site group block sits at its first member. */
function edgePlace(state: SidebarState, group: GroupRef, edge: 'above' | 'below'): Place | null {
  if (group.kind === 'tab') {
    const span = tabGroupSpan(state, group.groupId);
    if (!span) return null;
    return { windowId: span.windowId, at: edge === 'above' ? span.start : span.start + span.size };
  }
  const [first, ...others] = siteMembers(state, group.groupId);
  if (!first) return null;
  const last = others.filter((tab) => tab.windowId === first.windowId).at(-1) ?? first;
  return { windowId: first.windowId, at: edge === 'above' ? first.index : last.index + 1 };
}

const inAnyGroup = (state: SidebarState, tabId: number) =>
  state.tabGroups.some((group) => group.tabIds.includes(tabId)) ||
  state.siteGroups.some((group) => group.tabIds.includes(tabId));

function placeOf(state: SidebarState, target: DropTarget): Place | null {
  switch (target.zone) {
    case 'tab-row': {
      const row = state.unpinnedTabs.find((tab) => tab.id === target.tabId);
      // A member row is part of its block: the drop goes to the edge of the block.
      if (!row || inAnyGroup(state, row.id)) return null;
      return { windowId: row.windowId, at: row.index + (target.edge === 'below' ? 1 : 0) };
    }
    case 'group-edge':
      return edgePlace(state, target.group, target.edge);
    case 'unpinned': {
      const last = state.unpinnedTabs.at(-1);
      return last ? { windowId: last.windowId, at: 'end' } : null;
    }
    default:
      return null;
  }
}

function planTabGroupMove(
  state: SidebarState,
  group: TabGroupRef,
  place: Place,
): CommandBody | null {
  const span = tabGroupSpan(state, group.groupId);
  if (!span) return null;
  const move = (index: number) => moveGroupCommand(group, index, place.windowId);
  if (place.windowId !== span.windowId) return move(place.at === 'end' ? -1 : place.at);

  const end = span.start + span.size;
  if (place.at === 'end') {
    const trailing = state.unpinnedTabs.some(
      (tab) => tab.windowId === span.windowId && tab.index >= end,
    );
    return trailing ? move(-1) : null;
  }
  if (place.at >= span.start && place.at <= end) return null;
  // The tabs of the group leave the strip before they enter at the new place.
  return move(place.at > end ? place.at - span.size : place.at);
}

function planSiteGroupMove(
  state: SidebarState,
  group: SiteGroupRef,
  place: Place,
): CommandBody | null {
  const members = siteMembers(state, group.groupId);
  if (members.length === 0) return null;
  const move = (index: number) => moveGroupCommand(group, index, place.windowId);

  const there = members.filter((tab) => tab.windowId === place.windowId).map((tab) => tab.index);
  const first = Math.min(...there);
  const last = Math.max(...there);
  const together = there.length === members.length && last - first + 1 === members.length;

  if (place.at === 'end') {
    const ids = new Set(members.map((tab) => tab.id));
    const trailing = state.unpinnedTabs.some(
      (tab) => tab.windowId === place.windowId && !ids.has(tab.id) && tab.index > last,
    );
    return together && !trailing ? null : move(-1);
  }
  // The members that sit before the place leave the strip before they enter at the new place.
  const index = place.at - there.filter((at) => at < (place.at as number)).length;
  return together && first === index ? null : move(index);
}

/**
 * The command that moves a whole group to a drop target, or null when Sidesweep refuses the move or it changes nothing.
 * A tab row that is a member of a group counts as the edge of its block, so a group never lands inside another group.
 * `index` counts the strip as the move leaves it: the tabs of the group have left their old place.
 */
export function planGroupDrop(
  state: SidebarState,
  group: GroupRef,
  target: DropTarget,
): CommandBody | null {
  if (target.zone === 'group-edge' && sameGroup(target.group, group)) return null;
  const place = placeOf(state, target);
  if (!place) return null;
  return group.kind === 'tab'
    ? planTabGroupMove(state, group, place)
    : planSiteGroupMove(state, group, place);
}

const groupOfEntry = (entry: UnpinnedEntry): GroupRef | null => {
  if (entry.kind === 'group') return { kind: 'tab', groupId: entry.group.id };
  if (entry.kind === 'site-group') return { kind: 'site', groupId: entry.group.id };
  return null;
};

/**
 * The commands of "Move group up" and "Move group down": above the previous entry of the Unpinned Tabs, and below the next one.
 * An entry is a tab or a group block. A command is null when there is no such entry.
 */
export function planGroupStep(state: SidebarState, group: GroupRef) {
  const entries = arrangeUnpinned(state.unpinnedTabs, state.tabGroups, state.siteGroups);
  const at = entries.findIndex((entry) => {
    const ref = groupOfEntry(entry);
    return ref !== null && sameGroup(ref, group);
  });
  const toward = (entry: UnpinnedEntry | undefined, edge: 'above' | 'below') => {
    if (!entry) return null;
    const ref = groupOfEntry(entry);
    const target: DropTarget = ref
      ? { zone: 'group-edge', group: ref, edge }
      : { zone: 'tab-row', tabId: (entry as { tab: TabView }).tab.id, edge };
    return planGroupDrop(state, group, target);
  };
  if (at < 0) return { up: null, down: null };
  return { up: toward(entries[at - 1], 'above'), down: toward(entries[at + 1], 'below') };
}
