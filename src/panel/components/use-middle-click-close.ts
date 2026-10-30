import type { MouseEvent } from 'react';
import type { CommandBody } from '../connection';
import { usePanel } from '../panel-context';

const MIDDLE_BUTTON = 1;

/**
 * Event props for a row whose middle click sends one command: it closes a tab or deletes an item.
 * With no `command` the row has nothing to do: the props do nothing.
 */
export function useMiddleClickClose(command: CommandBody | undefined) {
  const { send } = usePanel();
  return {
    // Without this the browser starts its autoscroll mode on a middle mousedown.
    onMouseDown(event: MouseEvent) {
      if (command && event.button === MIDDLE_BUTTON) event.preventDefault();
    },
    onAuxClick(event: MouseEvent) {
      if (!command || event.button !== MIDDLE_BUTTON) return;
      event.preventDefault();
      send(command);
    },
  };
}
