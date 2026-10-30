import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { type RefObject, useEffect, useRef } from 'react';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';
import { usePanelDrag } from './drag-store';
import { planDrop } from './plan-drop';
import type { DropTarget } from './types';
import { readSource } from './use-dnd';

/**
 * Turns every drop of the panel into one command, and scrolls the panel while the pointer is near its edge.
 * The innermost drop target decides. No command goes out when Sidesweep refuses the drop.
 * Does nothing while a search shows.
 */
export function usePanelDnd(scroller: RefObject<HTMLElement | null>) {
  const { send } = usePanel();
  const sendRef = useRef(send);
  sendRef.current = send;
  const searching = usePanelUi((ui) => ui.searching);

  useEffect(() => {
    const element = scroller.current;
    if (!element || searching) return;
    const stop = monitorForElements({
      canMonitor: ({ source }) => readSource(source.data) !== null,
      onDragStart: ({ source }) => usePanelDrag.setState({ source: readSource(source.data) }),
      onDrop: ({ source, location }) => {
        usePanelDrag.setState({ source: null });
        const dragged = readSource(source.data);
        const target = location.current.dropTargets[0]?.data.target as DropTarget | undefined;
        if (!dragged || !target) return;
        const command = planDrop(usePanelStore.getState().state, dragged, target);
        if (command) sendRef.current(command);
      },
    });
    return () => {
      stop();
      usePanelDrag.setState({ source: null });
    };
  }, [scroller, searching]);

  useEffect(() => {
    const element = scroller.current;
    return element && !searching ? autoScrollForElements({ element }) : undefined;
  }, [scroller, searching]);
}
