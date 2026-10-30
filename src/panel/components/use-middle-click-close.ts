import type { MouseEvent } from 'react';
import type { CommandBody } from '../connection';
import { usePanel } from '../panel-context';

const MIDDLE_BUTTON = 1;

/**
 * Event props for a row whose middle click closes a tab or deletes an item.
 * The action is a command to send, or a function that decides what to do.
 * With no action the row has nothing to do: the props do nothing.
 */
export function useMiddleClickClose(action: CommandBody | (() => void) | undefined) {
  const { send } = usePanel();
  return {
    // Without this the browser starts its autoscroll mode on a middle mousedown.
    onMouseDown(event: MouseEvent) {
      if (action && event.button === MIDDLE_BUTTON) event.preventDefault();
    },
    onAuxClick(event: MouseEvent) {
      if (!action || event.button !== MIDDLE_BUTTON) return;
      event.preventDefault();
      if (typeof action === 'function') action();
      else send(action);
    },
  };
}
