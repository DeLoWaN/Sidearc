import type { ItemView } from '../shared/types';

/** An item of the Pinned Tabs tree, with the items inside it. Only a Folder has children. */
export interface TreeNode {
  item: ItemView;
  children: TreeNode[];
}

/**
 * Builds the tree of Folders and Pinned Tabs, each level ordered by position.
 * An item whose parent is missing goes to the root, so no item ever disappears.
 */
export function buildTree(items: ItemView[]): TreeNode[] {
  const inTree = items.filter((item) => item.kind === 'pinned' || item.kind === 'folder');
  const nodes = new Map(inTree.map((item) => [item.id, { item, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.item.parentId === null ? undefined : nodes.get(node.item.parentId);
    (parent ? parent.children : roots).push(node);
  }
  const byPosition = (a: TreeNode, b: TreeNode) => a.item.position - b.item.position;
  roots.sort(byPosition);
  for (const node of nodes.values()) node.children.sort(byPosition);
  return roots;
}
