/** One group block of the Unpinned Tabs: a Tab group, which Chrome numbers, or a site group, which Sidesweep numbers. */
export type GroupRef = { kind: 'tab'; groupId: number } | { kind: 'site'; groupId: string };

/**
 * What the user drags: an item (Favorite, Pinned Tab or Folder), an Unpinned Tab, a selection of rows, or a whole group.
 * A selection holds the Unpinned Tabs and the Pinned Tabs and Folders in the order of the panel,
 * and a Folder stands for its content.
 */
export type DragSource =
  | { type: 'item'; itemId: string }
  | { type: 'tab'; tabId: number }
  | { type: 'selection'; tabIds: number[]; itemIds: string[] }
  | ({ type: 'group' } & GroupRef);

/** Where the pointer is. Each zone is one kind of element of the panel. */
export type DropTarget =
  /** A row of the Pinned Tabs tree. "inside" only comes from a Folder row. */
  | { zone: 'tree-row'; itemId: string; placement: 'above' | 'below' | 'inside' }
  /** The Pinned Tabs section, away from any row. */
  | { zone: 'pinned-root' }
  | { zone: 'favorite-tile'; itemId: string; edge: 'before' | 'after' }
  /** The Favorites grid, away from any tile. */
  | { zone: 'favorites' }
  | { zone: 'tab-row'; tabId: number; edge: 'above' | 'below' }
  /** The top or the bottom half of a group block. Only a whole group drops there. */
  | { zone: 'group-edge'; group: GroupRef; edge: 'above' | 'below' }
  | { zone: 'tab-group'; groupId: number }
  /** A site group block. Only a selection of Unpinned Tabs drops there. */
  | { zone: 'site-group'; groupId: string }
  /** The Unpinned Tabs section, away from any tab. */
  | { zone: 'unpinned' };
