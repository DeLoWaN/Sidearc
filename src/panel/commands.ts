import type { SelectionTarget } from '../shared/protocol';
import type { CommandBody } from './connection';
import type { GroupRef } from './dnd/types';

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

/**
 * Moves a whole group to `index` of the tab strip of a window. The index is the place of its first tab when the move ends.
 * -1 means the end of the strip.
 */
export function moveGroupCommand(
  group: GroupRef,
  index: number,
  targetWindowId: number,
): Of<'group/move'> | Of<'site-group/move'> {
  return group.kind === 'tab'
    ? { type: 'group/move', groupId: group.groupId, index, targetWindowId }
    : { type: 'site-group/move', groupId: group.groupId, index, targetWindowId };
}

/** The Unpinned Tabs and the Pinned Tabs and Folders of a selection, in the order of the panel. */
export interface ChosenRows {
  tabIds: number[];
  itemIds: string[];
}

/** Closes the selected Unpinned Tabs and deletes the selected Pinned Tabs and Folders. */
export function selectionCloseCommand({ tabIds, itemIds }: ChosenRows): Of<'selection/close'> {
  return { type: 'selection/close', tabIds, itemIds };
}

/** Moves the selected rows to one target. "Move to…" and drag and drop build it here. */
export function selectionMoveCommand(
  { tabIds, itemIds }: ChosenRows,
  target: SelectionTarget,
): Of<'selection/move'> {
  return { type: 'selection/move', tabIds, itemIds, target };
}
