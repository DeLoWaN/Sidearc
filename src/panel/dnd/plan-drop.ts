import { subtreeIds } from '../../shared/item-tree';
import type { ItemView, SidebarState, TabView } from '../../shared/types';
import {
  addTabToGroupCommand,
  favoriteCommand,
  itemFromTabCommand,
  moveItemCommand,
  moveTabCommand,
  unpinCommand,
} from '../commands';
import type { CommandBody } from '../connection';
import type { DragSource, DropTarget } from './types';

const byPosition = (a: ItemView, b: ItemView) => a.position - b.position;

/** The Pinned Tabs and Folders inside one parent, in order, without the item that moves. */
function treeSiblings(items: ItemView[], parentId: string | null, leaving?: string): ItemView[] {
  return items
    .filter(
      (item) => item.kind !== 'favorite' && item.parentId === parentId && item.id !== leaving,
    )
    .sort(byPosition);
}

function favoritesWithout(items: ItemView[], leaving?: string): ItemView[] {
  return items.filter((item) => item.kind === 'favorite' && item.id !== leaving).sort(byPosition);
}

/** Where a row of the tree sends the item: a parent, and an index that is undefined for "the end". */
function treePlace(
  items: ItemView[],
  row: ItemView,
  placement: 'above' | 'below' | 'inside',
  leaving?: string,
): { parentId: string | null; index?: number } | null {
  if (placement === 'inside') {
    if (row.kind !== 'folder') return null;
    return { parentId: row.id, index: row.collapsed ? undefined : 0 };
  }
  const siblings = treeSiblings(items, row.parentId, leaving);
  const at = siblings.findIndex((sibling) => sibling.id === row.id);
  if (at < 0) return null;
  return { parentId: row.parentId, index: at + (placement === 'below' ? 1 : 0) };
}

function planItemDrop(
  state: SidebarState,
  source: ItemView,
  target: DropTarget,
): CommandBody | null {
  const { items } = state;
  switch (target.zone) {
    case 'tree-row': {
      const row = items.find((item) => item.id === target.itemId);
      // A Folder cannot go inside itself, and a row of the tree is never a Favorite.
      if (!row || row.kind === 'favorite' || subtreeIds(items, source.id).has(row.id)) return null;
      const place = treePlace(items, row, target.placement, source.id);
      return place && moveItemCommand(source.id, place.parentId, place.index);
    }
    case 'pinned-root':
      return moveItemCommand(source.id, null);
    case 'favorite-tile': {
      const tile = items.find((item) => item.id === target.itemId);
      if (source.kind === 'folder' || !tile || tile.id === source.id) return null;
      const at = favoritesWithout(items, source.id).findIndex((favorite) => favorite.id === tile.id);
      return at < 0 ? null : favoriteCommand(source.id, at + (target.edge === 'after' ? 1 : 0));
    }
    case 'favorites':
      return source.kind === 'pinned' ? favoriteCommand(source.id) : null;
    case 'unpinned':
    case 'tab-row':
      return source.kind === 'folder' ? null : unpinCommand(source.id);
    default:
      return null;
  }
}

function planItemFromTab(
  state: SidebarState,
  source: TabView,
  target: DropTarget,
): CommandBody | null {
  const { items } = state;
  switch (target.zone) {
    case 'tree-row': {
      const row = items.find((item) => item.id === target.itemId);
      if (!row || row.kind === 'favorite') return null;
      const place = treePlace(items, row, target.placement);
      return place && itemFromTabCommand(source.id, 'pinned', place.parentId, place.index);
    }
    case 'pinned-root':
      return itemFromTabCommand(source.id, 'pinned', null);
    case 'favorite-tile': {
      const at = favoritesWithout(items).findIndex((favorite) => favorite.id === target.itemId);
      return at < 0
        ? null
        : itemFromTabCommand(source.id, 'favorite', null, at + (target.edge === 'after' ? 1 : 0));
    }
    case 'favorites':
      return itemFromTabCommand(source.id, 'favorite', null);
    default:
      return null;
  }
}

/**
 * Reorders a tab in its tab strip. The index is the place where the tab ends, as `tabs.move` counts it.
 * The tab joins the group of the row when it lands between two tabs of that group, or when it already is in that group.
 * Otherwise it leaves its group. A drop that changes nothing, or that crosses windows, gives null.
 */
function planTabReorder(
  state: SidebarState,
  source: TabView,
  target: Extract<DropTarget, { zone: 'tab-row' }>,
): CommandBody | null {
  const row = state.unpinnedTabs.find((tab) => tab.id === target.tabId);
  if (!row || row.id === source.id || row.windowId !== source.windowId) return null;

  const insertAt = row.index + (target.edge === 'below' ? 1 : 0);
  const index = source.index < insertAt ? insertAt - 1 : insertAt;

  const groupOf = (tabId: number) => state.tabGroups.find((group) => group.tabIds.includes(tabId));
  const current = groupOf(source.id);
  const rowGroup = groupOf(row.id);
  let destination = null as number | null;
  if (rowGroup) {
    const others = rowGroup.tabIds.filter((id) => id !== source.id);
    const strictlyInside =
      target.edge === 'above' ? others[0] !== row.id : others[others.length - 1] !== row.id;
    if (strictlyInside || current === rowGroup) destination = rowGroup.id;
  }

  if (destination === (current?.id ?? null)) {
    return index === source.index ? null : moveTabCommand(source.id, index);
  }
  return moveTabCommand(source.id, index, destination);
}

function planTabDrop(state: SidebarState, source: TabView, target: DropTarget): CommandBody | null {
  switch (target.zone) {
    case 'tab-row':
      return planTabReorder(state, source, target);
    case 'tab-group': {
      const group = state.tabGroups.find((candidate) => candidate.id === target.groupId);
      if (!group || group.windowId !== source.windowId || group.tabIds.includes(source.id)) {
        return null;
      }
      return addTabToGroupCommand(source.id, group.id);
    }
    default:
      return planItemFromTab(state, source, target);
  }
}

/**
 * The command that a drop sends, or null when Sidearc refuses the drop and changes nothing.
 * The worker still refuses what depends on its own data, such as a 13th Favorite.
 */
export function planDrop(
  state: SidebarState,
  source: DragSource,
  target: DropTarget,
): CommandBody | null {
  if (source.type === 'item') {
    const item = state.items.find((candidate) => candidate.id === source.itemId);
    return item ? planItemDrop(state, item, target) : null;
  }
  const tab = state.unpinnedTabs.find((candidate) => candidate.id === source.tabId);
  return tab ? planTabDrop(state, tab, target) : null;
}
