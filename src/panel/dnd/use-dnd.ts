import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { selectionDragSource } from '../selection';
import { type SelectionId, usePanelSelection } from '../selection-store';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';
import { usePanelDrag } from './drag-store';
import { showBlockPreview } from './group-preview';
import type { Locate } from './locators';
import { planDrop } from './plan-drop';
import { showSelectionPreview } from './selection-preview';
import type { DragSource, DropTarget } from './types';

/** Where the drop indicator shows on an element. */
export type Placement = 'above' | 'below' | 'inside' | 'before' | 'after';

const placementOf = (target: DropTarget, dragged: DragSource): Placement => {
  if (target.zone === 'tree-row') return target.placement;
  if (target.zone === 'tab-row' || target.zone === 'group-edge') return target.edge;
  if (target.zone === 'favorite-tile') return target.edge;
  // A group that drops on the section goes after the last tab: a line marks the end of the list.
  if (target.zone === 'unpinned' && dragged.type === 'group') return 'below';
  return 'inside';
};

export function readSource(data: Record<string | symbol, unknown>): DragSource | null {
  if (data.type === 'item' && typeof data.itemId === 'string') {
    return { type: 'item', itemId: data.itemId };
  }
  if (data.type === 'tab' && typeof data.tabId === 'number') {
    return { type: 'tab', tabId: data.tabId };
  }
  if (data.type === 'selection' && Array.isArray(data.tabIds) && Array.isArray(data.itemIds)) {
    return { type: 'selection', tabIds: data.tabIds, itemIds: data.itemIds };
  }
  if (data.type === 'group' && data.kind === 'tab' && typeof data.groupId === 'number') {
    return { type: 'group', kind: 'tab', groupId: data.groupId };
  }
  if (data.type === 'group' && data.kind === 'site' && typeof data.groupId === 'string') {
    return { type: 'group', kind: 'site', groupId: data.groupId };
  }
  return null;
}

interface DndOptions {
  /** Makes the element draggable. */
  source?: DragSource;
  /** False takes the drag away: the element is not draggable at all, so a text field inside it works. */
  canDrag?: boolean;
  /** The element that a drag of a group shows as its drag image, instead of the dragged element alone. */
  preview?: () => HTMLElement | null;
  /**
   * The selectable row that the element is. A drag that starts on a selected row carries the whole selection,
   * and every selected row dims while it drags.
   */
  row?: SelectionId;
  /** Makes the element a drop target. */
  locate?: Locate;
}

/**
 * Makes an element draggable and a drop target, and says where its drop indicator shows.
 * Does nothing while a search shows: the result view has no place to drop on.
 * The indicator shows only on the innermost target under the pointer, and only for a drop that Sidesweep accepts.
 */
export function useDnd(ref: RefObject<HTMLElement | null>, options: DndOptions) {
  const searching = usePanelUi((ui) => ui.searching);
  const latest = useRef(options);
  latest.current = options;
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [dragging, setDragging] = useState(false);
  const selectionDragging = usePanelDrag((drag) => drag.source?.type === 'selection');
  const inSelection = usePanelSelection((selection) =>
    selection.selected.some(
      (other) => other.kind === options.row?.kind && other.id === options.row.id,
    ),
  );
  const isDraggable = Boolean(options.source) && options.canDrag !== false;
  const isDropTarget = Boolean(options.locate);

  useEffect(() => {
    const element = ref.current;
    if (!element || searching) return;
    const show = ({
      self,
      location,
      source,
    }: {
      self: { element: Element; data: Record<string | symbol, unknown> };
      location: { current: { dropTargets: { element: Element }[] } };
      source: { data: Record<string | symbol, unknown> };
    }) => {
      const dragged = readSource(source.data);
      const target = self.data.target as DropTarget;
      const innermost = location.current.dropTargets[0]?.element === self.element;
      const accepted =
        innermost && dragged && planDrop(usePanelStore.getState().state, dragged, target);
      setPlacement(dragged && accepted ? placementOf(target, dragged) : null);
    };
    const hide = () => setPlacement(null);

    const cleanups: (() => void)[] = [];
    if (isDraggable) {
      cleanups.push(
        draggable({
          element,
          getInitialData: () => {
            const { row, source } = latest.current;
            const carried =
              row &&
              selectionDragSource(
                usePanelStore.getState().state,
                usePanelSelection.getState().selected,
                row,
              );
            return { ...(carried || source) };
          },
          onGenerateDragPreview: ({ nativeSetDragImage, source, location }) => {
            const carried = readSource(source.data);
            if (!nativeSetDragImage) return;
            if (carried?.type === 'selection') {
              showSelectionPreview(
                carried.tabIds.length + carried.itemIds.length,
                nativeSetDragImage,
              );
            } else if (carried?.type === 'group') {
              const block = latest.current.preview?.();
              if (block) showBlockPreview(block, location.current.input, nativeSetDragImage);
            }
          },
          onDragStart: () => setDragging(true),
          onDrop: () => setDragging(false),
        }),
      );
    }
    if (isDropTarget) {
      const locate = (args: Parameters<Locate>[0]) => latest.current.locate?.(args) ?? null;
      cleanups.push(
        dropTargetForElements({
          element,
          canDrop: ({ source, input, element }) => {
            const dragged = readSource(source.data);
            return Boolean(dragged && locate({ source: dragged, input, element }));
          },
          getData: ({ source, input, element }) => {
            const dragged = readSource(source.data);
            return { target: dragged && locate({ source: dragged, input, element }) };
          },
          onDragEnter: show,
          onDrag: show,
          onDragLeave: hide,
          onDrop: hide,
        }),
      );
    }
    return combine(...cleanups);
  }, [ref, searching, isDraggable, isDropTarget]);

  return { placement, dragging: dragging || (inSelection && selectionDragging) };
}
