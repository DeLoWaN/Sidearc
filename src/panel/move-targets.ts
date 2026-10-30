import { subtreeIds } from '../shared/item-tree';
import type { ItemView, TabGroupView, TabView } from '../shared/types';
import { buildTree, type TreeNode } from './build-tree';
import type { MoveTarget } from './components/MoveToMenu';

/** Every Folder of the tree in display order, with its depth (1 at the root). */
function listFolders(nodes: TreeNode[], depth = 1): { folder: ItemView; depth: number }[] {
  return nodes
    .filter((node) => node.item.kind === 'folder')
    .flatMap((node) => [{ folder: node.item, depth }, ...listFolders(node.children, depth + 1)]);
}

/**
 * Where an item can go. A Favorite can only become a Pinned Tab at the root.
 * A Pinned Tab can go to the Favorites, then the root, then the Folders in tree order.
 * A Folder can go to the root and the Folders. Leaves out the place where the item already is,
 * and, for a Folder, itself and its content.
 */
export function itemMoveTargets(items: ItemView[], item: ItemView): MoveTarget[] {
  const root = {
    key: 'root',
    label: 'Pinned Tabs',
    command: { type: 'item/move' as const, itemId: item.id, parentId: null },
  };
  if (item.kind === 'favorite') return [root];
  const unavailable = item.kind === 'folder' ? subtreeIds(items, item.id) : new Set<string>();
  const folderTargets = listFolders(buildTree(items))
    .filter(({ folder }) => !unavailable.has(folder.id) && folder.id !== item.parentId)
    .map(({ folder, depth }) => ({
      key: folder.id,
      label: folder.title,
      depth,
      command: { type: 'item/move' as const, itemId: item.id, parentId: folder.id },
    }));
  const favorites: MoveTarget[] =
    item.kind === 'pinned'
      ? [
          {
            key: 'favorites',
            label: 'Favorites',
            command: { type: 'item/favorite', itemId: item.id },
          },
        ]
      : [];
  return [...favorites, ...(item.parentId === null ? [] : [root]), ...folderTargets];
}

/** Where an Unpinned Tab can go: every Tab group but its own, then "Out of group" when it is in one. */
export function tabMoveTargets(groups: TabGroupView[], tab: TabView): MoveTarget[] {
  const current = groups.find((group) => group.tabIds.includes(tab.id));
  const targets: MoveTarget[] = groups
    .filter((group) => group !== current)
    .map((group) => ({
      key: `group-${group.id}`,
      label: group.title || 'Untitled group',
      command: { type: 'group/add-tab', tabId: tab.id, groupId: group.id },
    }));
  if (current) {
    targets.push({
      key: 'out-of-group',
      label: 'Out of group',
      command: { type: 'group/remove-tab', tabId: tab.id },
    });
  }
  return targets;
}
