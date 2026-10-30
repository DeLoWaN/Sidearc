import type { MouseEvent } from 'react';
import { usePanel } from '../panel-context';

const MIDDLE_BUTTON = 1;

/**
 * Event props for a row whose middle click closes a Chrome tab.
 * With no `tabId` the row has no open tab: the props do nothing.
 */
export function useMiddleClickClose(tabId: number | undefined) {
  const { send } = usePanel();
  return {
    // Without this the browser starts its autoscroll mode on a middle mousedown.
    onMouseDown(event: MouseEvent) {
      if (tabId !== undefined && event.button === MIDDLE_BUTTON) event.preventDefault();
    },
    onAuxClick(event: MouseEvent) {
      if (tabId === undefined || event.button !== MIDDLE_BUTTON) return;
      event.preventDefault();
      send({ type: 'tab/close', tabId });
    },
  };
}
