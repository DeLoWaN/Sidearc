/** What the user drags: an item (Favorite, Pinned Tab or Folder) or an Unpinned Tab. */
export type DragSource = { type: 'item'; itemId: string } | { type: 'tab'; tabId: number };

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
  | { zone: 'tab-group'; groupId: number }
  /** The Unpinned Tabs section, away from any tab. */
  | { zone: 'unpinned' };
