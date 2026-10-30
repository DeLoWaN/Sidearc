import type { ItemRecord } from './types';

/** A profile has this many Favorites at most. */
export const MAX_FAVORITES = 12;

/** The ids of the item and of everything below it. */
export function subtreeIds(items: ItemRecord[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const item of items) {
      if (item.parentId !== null && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** How many items lie below the item, at any depth. */
export function countBelow(items: ItemRecord[], id: string): number {
  return subtreeIds(items, id).size - 1;
}

/** True when the id is null (the root) or the id of a Folder. */
export function isFolderOrRoot(items: ItemRecord[], id: string | null): boolean {
  return id === null || items.some((item) => item.id === id && item.kind === 'folder');
}

/**
 * The position that puts an item after the other items of the parent.
 * At the root, the Favorites and the Pinned Tabs are two separate lists.
 */
export function endPosition(
  items: ItemRecord[],
  parentId: string | null,
  favorite = false,
): number {
  const positions = items
    .filter((item) => item.parentId === parentId && (item.kind === 'favorite') === favorite)
    .map((i) => i.position);
  return Math.max(-1, ...positions) + 1;
}
