import type { MouseEvent } from 'react';
import { claimContextMenu } from '../selection-actions';
import { usePanelUi } from '../ui-store';

/** The button or link under the pointer: the menu gives it the focus back. */
export function focusableUnder(target: EventTarget): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('button, a, [tabindex]') : null;
}

/**
 * Returns the right-click handler that opens the item menu at the pointer.
 * `itemId` is null for the root of the Pinned Tabs.
 * The handler does nothing when an element below already handled the click.
 */
export function useItemContextMenu(itemId: string | null) {
  const openMenu = usePanelUi((ui) => ui.openMenu);
  return (event: MouseEvent) => {
    if (event.defaultPrevented) return;
    const opener = focusableUnder(event.target);
    // The root has no row: only a row of a selection gets the menu of the selection.
    if (itemId !== null && claimContextMenu(event, { kind: 'item', id: itemId }, opener)) return;
    event.preventDefault();
    openMenu(itemId, event.clientX, event.clientY, opener);
  };
}
