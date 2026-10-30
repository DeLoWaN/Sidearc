import { topLevelIds } from '../shared/item-tree';
import type { SidebarState } from '../shared/types';
import { buildTree, type TreeNode } from './build-tree';
import type { ChosenRows } from './commands';
import type { DragSource } from './dnd/types';
import { type SelectionId, sameRow } from './selection-store';
import { arrangeUnpinned } from './tab-groups';

/**
 * The selectable rows in the order of the panel: the Pinned Tabs tree, then the Unpinned Tabs.
 * `onlyVisible` leaves out the content of a collapsed Folder, Tab group and site group.
 * Favorites and group headers are not rows of a selection.
 */
export function rowOrder(state: SidebarState, onlyVisible: boolean): SelectionId[] {
  const rows: SelectionId[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const { item, children } of nodes) {
      rows.push({ kind: 'item', id: item.id });
      if (!(onlyVisible && item.kind === 'folder' && item.collapsed)) walk(children);
    }
  };
  walk(buildTree(state.items));
  for (const entry of arrangeUnpinned(state.unpinnedTabs, state.tabGroups, state.siteGroups)) {
    if (entry.kind === 'tab') rows.push({ kind: 'tab', id: entry.tab.id });
    else if (!(onlyVisible && entry.group.collapsed)) {
      for (const tab of entry.tabs) rows.push({ kind: 'tab', id: tab.id });
    }
  }
  return rows;
}

/**
 * The rows from the anchor to the row, both included, in the visible order of the panel.
 * Only the row itself when the anchor is missing or hidden.
 */
export function rowRange(
  state: SidebarState,
  anchor: SelectionId | undefined,
  row: SelectionId,
): SelectionId[] {
  const rows = rowOrder(state, true);
  const from = anchor ? rows.findIndex((other) => sameRow(other, anchor)) : -1;
  const to = rows.findIndex((other) => sameRow(other, row));
  if (from < 0 || to < 0) return [row];
  return rows.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/**
 * What an action acts on: the selected rows that the state still shows, in the order of the panel.
 * A selected Folder stands for its content, so a selected row below it does not count.
 */
export function chosenRows(state: SidebarState, selected: SelectionId[]): ChosenRows {
  const rank = new Map(
    rowOrder(state, false).map((row, index) => [`${row.kind}:${row.id}`, index]),
  );
  const known = selected
    .filter((row) => rank.has(`${row.kind}:${row.id}`))
    .sort(
      (a, b) =>
        (rank.get(`${a.kind}:${a.id}`) as number) - (rank.get(`${b.kind}:${b.id}`) as number),
    );
  return {
    tabIds: known.flatMap((row) => (row.kind === 'tab' ? [row.id] : [])),
    itemIds: topLevelIds(
      state.items,
      known.flatMap((row) => (row.kind === 'item' ? [row.id] : [])),
    ),
  };
}

/** How many rows an action acts on. */
export const chosenCount = ({ tabIds, itemIds }: ChosenRows) => tabIds.length + itemIds.length;

/**
 * What a drag that starts on the row carries: the whole selection when the row is selected and
 * the selection holds several rows, and null when the row drags alone.
 */
export function selectionDragSource(
  state: SidebarState,
  selected: SelectionId[],
  row: SelectionId,
): DragSource | null {
  if (!selected.some((other) => sameRow(other, row))) return null;
  const chosen = chosenRows(state, selected);
  return chosenCount(chosen) > 1 ? { type: 'selection', ...chosen } : null;
}
