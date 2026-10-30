import type { CommandBody } from './connection';

/**
 * The commands that move an item or a tab. "Move to…" and drag and drop build them here,
 * so that both ways of moving send the same command.
 * An index that is undefined stays out of the command.
 */

type Of<T extends CommandBody['type']> = Extract<CommandBody, { type: T }>;

/** Puts an item in a Folder (null for the root), at the index or at the end. */
export function moveItemCommand(
  itemId: string,
  parentId: string | null,
  index?: number,
): Of<'item/move'> {
  return { type: 'item/move', itemId, parentId, ...(index === undefined ? {} : { index }) };
}

/** Makes a Pinned Tab a Favorite, or moves a Favorite among the Favorites. */
export function favoriteCommand(itemId: string, index?: number): Of<'item/favorite'> {
  return { type: 'item/favorite', itemId, ...(index === undefined ? {} : { index }) };
}

export function unpinCommand(itemId: string): Of<'item/unpin'> {
  return { type: 'item/unpin', itemId };
}

/** Saves an Unpinned Tab as a Pinned Tab or a Favorite. */
export function itemFromTabCommand(
  tabId: number,
  kind: 'pinned' | 'favorite',
  parentId: string | null,
  index?: number,
): Of<'item/from-tab'> {
  return {
    type: 'item/from-tab',
    tabId,
    kind,
    parentId,
    ...(index === undefined ? {} : { index }),
  };
}

export function addTabToGroupCommand(tabId: number, groupId: number): Of<'group/add-tab'> {
  return { type: 'group/add-tab', tabId, groupId };
}

export function removeTabFromGroupCommand(tabId: number): Of<'group/remove-tab'> {
  return { type: 'group/remove-tab', tabId };
}

/**
 * Moves a tab in its tab strip. `groupId` also joins a group, and null leaves the group.
 * `targetWindowId` moves the tab into that window.
 */
export function moveTabCommand(
  tabId: number,
  index: number,
  groupId?: number | null,
  targetWindowId?: number,
): Of<'tab/move'> {
  return {
    type: 'tab/move',
    tabId,
    index,
    ...(groupId === undefined ? {} : { groupId }),
    ...(targetWindowId === undefined ? {} : { targetWindowId }),
  };
}
