import { subtreeIds } from '../shared/item-tree';
import type { ItemView, TabGroupView, TabView } from '../shared/types';
import { buildTree, type TreeNode } from './build-tree';
import {
  addTabToGroupCommand,
  favoriteCommand,
  moveItemCommand,
  removeTabFromGroupCommand,
  unpinCommand,
} from './commands';
import type { MoveTarget } from './move-target';

/** Every Folder of the tree in display order, with its depth (1 at the root). */
function listFolders(nodes: TreeNode[], depth = 1): { folder: ItemView; depth: number }[] {
  return nodes
    .filter((node) => node.item.kind === 'folder')
    .flatMap((node) => [{ folder: node.item, depth }, ...listFolders(node.children, depth + 1)]);
}

/**
 * Where an item can go. A Favorite can only become a Pinned Tab at the root.
 * A Pinned Tab can go to the Favorites, then the root, then the Folders in tree order, then the Unpinned Tabs.
 * A Favorite can also go to the Unpinned Tabs.
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
  if (item.kind === 'favorite') return [root, unpinned];
  const unavailable = item.kind === 'folder' ? subtreeIds(items, item.id) : new Set<string>();
  const folderTargets = listFolders(buildTree(items))
    .filter(({ folder }) => !unavailable.has(folder.id) && folder.id !== item.parentId)
    .map(({ folder, depth }) => ({
      key: folder.id,
      label: folder.title,
      depth,
      command: moveItemCommand(item.id, folder.id),
    }));
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
  return [...favorites, ...(item.parentId === null ? [] : [root]), ...folderTargets, ...unpin];
}

/** Where an Unpinned Tab can go: every Tab group but its own, then "Out of group" when it is in one. */
export function tabMoveTargets(groups: TabGroupView[], tab: TabView): MoveTarget[] {
  const current = groups.find((group) => group.tabIds.includes(tab.id));
  const targets: MoveTarget[] = groups
    .filter((group) => group !== current)
    .map((group) => ({
      key: `group-${group.id}`,
      label: group.title || 'Untitled group',
      command: addTabToGroupCommand(tab.id, group.id),
    }));
  if (current) {
    targets.push({
      key: 'out-of-group',
      label: 'Out of group',
      command: removeTabFromGroupCommand(tab.id),
    });
  }
  return targets;
}
