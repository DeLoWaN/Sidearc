import type { Input } from '@atlaskit/pragmatic-drag-and-drop/types';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/attach-closest-edge';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/extract-closest-edge';
import {
  attachInstruction,
  extractInstruction,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import type { ItemView } from '../../shared/types';
import { usePanelStore } from '../store';
import type { DragSource, DropTarget } from './types';

const isFolder = (source: DragSource) =>
  source.type === 'item' &&
  usePanelStore
    .getState()
    .state.items.some((item) => item.id === source.itemId && item.kind === 'folder');

/** Turns the pointer position over an element into a drop target, or null when the element refuses the source. */
export type Locate = (args: {
  source: DragSource;
  input: Input;
  element: Element;
}) => DropTarget | null;

function closestEdge(
  input: Input,
  element: Element,
  edges: ('top' | 'bottom' | 'left' | 'right')[],
) {
  return extractClosestEdge(attachClosestEdge({}, { input, element, allowedEdges: edges }));
}

/** A Pinned Tab row: the upper half is "above", the lower half is "below". */
export const pinnedRowTarget =
  (item: ItemView): Locate =>
  ({ input, element }) => {
    const edge = closestEdge(input, element, ['top', 'bottom']);
    return (
      edge && { zone: 'tree-row', itemId: item.id, placement: edge === 'top' ? 'above' : 'below' }
    );
  };

/**
 * A Folder row: the tree hitbox gives "above", "inside" and "below".
 * An open Folder has no "below": the place under its row is inside it.
 */
export const folderRowTarget =
  (item: ItemView): Locate =>
  ({ input, element }) => {
    const hit = extractInstruction(
      attachInstruction(
        {},
        {
          input,
          element,
          currentLevel: 0,
          indentPerLevel: 0,
          mode: item.collapsed ? 'standard' : 'expanded',
          block: [],
        },
      ),
    );
    if (hit?.type === 'reorder-above')
      return { zone: 'tree-row', itemId: item.id, placement: 'above' };
    if (hit?.type === 'reorder-below')
      return { zone: 'tree-row', itemId: item.id, placement: 'below' };
    if (hit?.type === 'make-child')
      return { zone: 'tree-row', itemId: item.id, placement: 'inside' };
    return null;
  };

export const favoriteTileTarget =
  (item: ItemView): Locate =>
  ({ source, input, element }) => {
    // A Folder cannot become a Favorite: the Favorites section refuses it too, so the cursor shows "no drop".
    // A selection never goes to the Favorites.
    if (isFolder(source) || source.type === 'selection') return null;
    const edge = closestEdge(input, element, ['left', 'right']);
    return (
      edge && { zone: 'favorite-tile', itemId: item.id, edge: edge === 'left' ? 'before' : 'after' }
    );
  };

export const tabRowTarget =
  (tabId: number): Locate =>
  ({ source, input, element }) => {
    // An item dropped on a tab row goes to the Unpinned Tabs section, which holds the rule.
    if (source.type !== 'tab') return null;
    const edge = closestEdge(input, element, ['top', 'bottom']);
    return edge && { zone: 'tab-row', tabId, edge: edge === 'top' ? 'above' : 'below' };
  };

/** A selection of Unpinned Tabs only: a Pinned Tab or a Folder cannot join a group. */
const holdsTabsOnly = (source: DragSource) =>
  source.type === 'selection' && source.itemIds.length === 0;

export const tabGroupTarget =
  (groupId: number): Locate =>
  ({ source }) =>
    source.type === 'tab' || holdsTabsOnly(source) ? { zone: 'tab-group', groupId } : null;

export const siteGroupTarget =
  (groupId: string): Locate =>
  ({ source }) =>
    holdsTabsOnly(source) ? { zone: 'site-group', groupId } : null;

const holdsFolder = (source: DragSource) =>
  source.type === 'selection' &&
  source.itemIds.some((id) => isFolder({ type: 'item', itemId: id }));

const section =
  (
    zone: 'pinned-root' | 'favorites' | 'unpinned',
    accepts: (source: DragSource) => boolean,
  ): Locate =>
  ({ source }) =>
    accepts(source) ? { zone } : null;

/** A whole section takes what no row inside it took. */
export const pinnedSectionTarget = section('pinned-root', () => true);
export const favoritesSectionTarget = section(
  'favorites',
  (source) => source.type !== 'selection' && !isFolder(source),
);
export const unpinnedSectionTarget = section(
  'unpinned',
  (source) =>
    (source.type === 'item' && !isFolder(source)) ||
    (source.type === 'selection' && !holdsFolder(source)),
);
