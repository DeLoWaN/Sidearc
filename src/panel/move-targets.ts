import { subtreeIds } from '../shared/item-tree';
import type { SelectionTarget } from '../shared/protocol';
import type { ItemView, SidebarState, TabGroupView, TabView } from '../shared/types';
import { buildTree, type TreeNode } from './build-tree';
import {
  addTabToGroupCommand,
  type ChosenRows,
  favoriteCommand,
  itemFromTabCommand,
  moveItemCommand,
  removeTabFromGroupCommand,
  unpinCommand,
} from './commands';
import type { CommandBody } from './connection';
import { planSelectionMove } from './dnd/plan-drop';
import type { MoveTarget } from './move-target';

/** Every Folder of the tree in display order, with its depth (1 at the root). */
function listFolders(nodes: TreeNode[], depth = 1): { folder: ItemView; depth: number }[] {
  return nodes
    .filter((node) => node.item.kind === 'folder')
    .flatMap((node) => [{ folder: node.item, depth }, ...listFolders(node.children, depth + 1)]);
}

/** One target for each Folder of the tree, in display order, except the Folders in `hidden`. */
function folderTargets(
  items: ItemView[],
  hidden: Set<string>,
  commandFor: (folderId: string) => CommandBody,
): MoveTarget[] {
  return listFolders(buildTree(items))
    .filter(({ folder }) => !hidden.has(folder.id))
    .map(({ folder, depth }) => ({
      key: folder.id,
      label: folder.title,
      depth,
      command: commandFor(folder.id),
    }));
}

/**
 * Where an item can go.
 * A Pinned Tab can go to the Favorites, then the root, then the Folders in tree order, then the Unpinned Tabs.
 * A Favorite can go to the root, the Folders and the Unpinned Tabs.
 * A Folder can go to the root and the Folders. Leaves out the place where the item already is,
 * and, for a Folder, itself and its content.
 */
export function itemMoveTargets(items: ItemView[], item: ItemView): MoveTarget[] {
  const root = {
    key: 'root',
    label: 'Pinned Tabs',
    command: moveItemCommand(item.id, null),
  };
  const unpinned: MoveTarget = {
    key: 'unpinned',
    label: 'Unpinned Tabs',
    command: unpinCommand(item.id),
  };
  const hidden = item.kind === 'folder' ? subtreeIds(items, item.id) : new Set<string>();
  if (item.parentId !== null) hidden.add(item.parentId);
  const folders = folderTargets(items, hidden, (folderId) => moveItemCommand(item.id, folderId));
  if (item.kind === 'favorite') return [root, ...folders, unpinned];
  const favorites: MoveTarget[] =
    item.kind === 'pinned'
      ? [
          {
            key: 'favorites',
            label: 'Favorites',
            command: favoriteCommand(item.id),
          },
        ]
      : [];
  const unpin = item.kind === 'pinned' ? [unpinned] : [];
  return [...favorites, ...(item.parentId === null ? [] : [root]), ...folders, ...unpin];
}

/**
 * Where an Unpinned Tab can go: the Favorites, the root of the Pinned Tabs and every Folder,
 * then every Tab group but its own, then "Out of group" when it is in one.
 */
export function tabMoveTargets(
  items: ItemView[],
  groups: TabGroupView[],
  tab: TabView,
): MoveTarget[] {
  const current = groups.find((group) => group.tabIds.includes(tab.id));
  const targets: MoveTarget[] = [
    { key: 'favorites', label: 'Favorites', command: itemFromTabCommand(tab.id, 'favorite', null) },
    { key: 'root', label: 'Pinned Tabs', command: itemFromTabCommand(tab.id, 'pinned', null) },
    ...folderTargets(items, new Set(), (folderId) =>
      itemFromTabCommand(tab.id, 'pinned', folderId),
    ),
  ];
  targets.push(
    ...groups
      .filter((group) => group !== current)
      .map((group) => ({
        key: `group-${group.id}`,
        label: group.title || 'Untitled group',
        command: addTabToGroupCommand(tab.id, group.id),
      })),
  );
  if (current) {
    targets.push({
      key: 'out-of-group',
      label: 'Out of group',
      command: removeTabFromGroupCommand(tab.id),
    });
  }
  return targets;
}

/**
 * Where a selection can go: the root of the Pinned Tabs, the Folders in tree order, the Unpinned Tabs,
 * the Tab groups, then the site groups. Lists only the places that fit the whole selection, as the drops do,
 * and leaves out a place where every selected item is already and no tab waits to move.
 */
export function selectionMoveTargets(state: SidebarState, rows: ChosenRows): MoveTarget[] {
  const { items, tabGroups, siteGroups } = state;
  const parentOf = (id: string) => items.find((item) => item.id === id)?.parentId;
  const alreadyThere = (parentId: string | null) =>
    rows.tabIds.length === 0 && rows.itemIds.every((id) => parentOf(id) === parentId);
  const candidates: { key: string; label: string; depth?: number; target: SelectionTarget }[] = [
    ...(alreadyThere(null)
      ? []
      : [
          {
            key: 'root',
            label: 'Pinned Tabs',
            target: { kind: 'pinned', parentId: null } as const,
          },
        ]),
    ...listFolders(buildTree(items))
      .filter(({ folder }) => !alreadyThere(folder.id))
      .map(({ folder, depth }) => ({
        key: folder.id,
        label: folder.title,
        depth,
        target: { kind: 'pinned', parentId: folder.id } as const,
      })),
    { key: 'unpinned', label: 'Unpinned Tabs', target: { kind: 'unpinned' } as const },
    ...tabGroups.map((group) => ({
      key: `group-${group.id}`,
      label: group.title || 'Untitled group',
      target: { kind: 'tab-group', groupId: group.id } as const,
    })),
    ...siteGroups.map((group) => ({
      key: `site-group-${group.id}`,
      label: group.name ?? group.host,
      target: { kind: 'site-group', groupId: group.id } as const,
    })),
  ];
  return candidates.flatMap(({ target, ...place }) => {
    const command = planSelectionMove(state, rows, target);
    return command ? [{ ...place, command }] : [];
  });
}
