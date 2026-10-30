import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';
import type { Locate } from './locators';
import { planDrop } from './plan-drop';
import type { DragSource, DropTarget } from './types';

/** Where the drop indicator shows on an element. */
export type Placement = 'above' | 'below' | 'inside' | 'before' | 'after';

const placementOf = (target: DropTarget): Placement => {
  if (target.zone === 'tree-row') return target.placement;
  if (target.zone === 'tab-row') return target.edge;
  if (target.zone === 'favorite-tile') return target.edge;
  return 'inside';
};

export function readSource(data: Record<string | symbol, unknown>): DragSource | null {
  if (data.type === 'item' && typeof data.itemId === 'string') {
    return { type: 'item', itemId: data.itemId };
  }
  if (data.type === 'tab' && typeof data.tabId === 'number') {
    return { type: 'tab', tabId: data.tabId };
  }
  return null;
}

interface DndOptions {
  /** Makes the element draggable. */
  source?: DragSource;
  canDrag?: boolean;
  /** Makes the element a drop target. */
  locate?: Locate;
}

/**
 * Makes an element draggable and a drop target, and says where its drop indicator shows.
 * Does nothing while a search shows: the result view has no place to drop on.
 * The indicator shows only on the innermost target under the pointer, and only for a drop that Sidearc accepts.
 */
export function useDnd(ref: RefObject<HTMLElement | null>, options: DndOptions) {
  const searching = usePanelUi((ui) => ui.searching);
  const latest = useRef(options);
  latest.current = options;
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggable_ = Boolean(options.source);
  const droppable = Boolean(options.locate);

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
      setPlacement(accepted ? placementOf(target) : null);
    };
    const hide = () => setPlacement(null);

    const cleanups = [];
    if (draggable_) {
      cleanups.push(
        draggable({
          element,
          canDrag: () => latest.current.canDrag !== false,
          getInitialData: () => ({ ...latest.current.source }),
          onDragStart: () => setDragging(true),
          onDrop: () => setDragging(false),
        }),
      );
    }
    if (droppable) {
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
  }, [ref, searching, draggable_, droppable]);

  return { placement, dragging };
}
