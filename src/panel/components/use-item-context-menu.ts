import type { MouseEvent } from 'react';
import { usePanelUi } from '../ui-store';

/**
 * Returns the right-click handler that opens the item menu at the pointer.
 * `itemId` is null for the root of the Pinned Tabs.
 * The handler does nothing when an element below already handled the click.
 */
export function useItemContextMenu(itemId: string | null) {
  const openMenu = usePanelUi((ui) => ui.openMenu);
  return (event: MouseEvent) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    openMenu(itemId, event.clientX, event.clientY);
  };
}
