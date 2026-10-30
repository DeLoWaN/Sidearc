import { type MouseEvent, useEffect } from 'react';
import { countBelow } from '../shared/item-tree';
import { selectionCloseCommand } from './commands';
import type { Connection } from './connection';
import { usePanel } from './panel-context';
import { chosenCount, chosenRows, rowRange } from './selection';
import { type SelectionId, sameRow, usePanelSelection } from './selection-store';
import { usePanelStore } from './store';
import { usePanelUi } from './ui-store';
import { isTextField } from './use-undo-shortcut';

/** Whether the row is selected, and whether the panel holds a selection: only then do the rows say "pressed" or not. */
export function useRowSelection(row: SelectionId) {
  const selected = usePanelSelection((selection) =>
    selection.selected.some((other) => sameRow(other, row)),
  );
  const marking = usePanelSelection((selection) => selection.selected.length > 0);
  return { selected, marking };
}

/**
 * Handles the modifier keys of a click on a row. Returns true when the click only changed the selection.
 * Ctrl or Cmd toggles the row. Shift selects the rows from the anchor to this row.
 * Any other click empties the selection and returns false: the row does its normal action.
 * While a search shows, a click never selects.
 */
export function selectOnClick(
  event: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  row: SelectionId,
): boolean {
  if (usePanelUi.getState().searching) return false;
  const selection = usePanelSelection.getState();
  if (event.ctrlKey || event.metaKey) {
    selection.toggle(row);
    return true;
  }
  if (event.shiftKey) {
    selection.replace(rowRange(usePanelStore.getState().state, selection.anchor, row), row);
    return true;
  }
  selection.clear();
  return false;
}

/**
 * Handles the right click on a row. On a selected row it opens the menu of the selection and returns true.
 * On any other row it empties the selection and returns false: the row shows its own menu.
 */
export function claimContextMenu(
  event: Pick<MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>,
  row: SelectionId,
  opener: HTMLElement | null,
): boolean {
  if (usePanelUi.getState().searching) return false;
  const selection = usePanelSelection.getState();
  if (selection.selected.some((other) => sameRow(other, row))) {
    event.preventDefault();
    selection.openMenu(event.clientX, event.clientY, opener);
    return true;
  }
  selection.clear();
  return false;
}

/** The rows that an action acts on now. */
export function currentRows() {
  return chosenRows(usePanelStore.getState().state, usePanelSelection.getState().selected);
}

/**
 * Closes the selected rows. Asks the user first when a selected Folder holds items.
 * The send function ends the selection.
 */
export function closeSelection(send: Connection['send']) {
  const rows = currentRows();
  if (chosenCount(rows) === 0) return;
  const { items } = usePanelStore.getState().state;
  usePanelSelection.getState().closeMenu();
  if (rows.itemIds.some((id) => countBelow(items, id) > 0)) {
    usePanelSelection.getState().askCloseConfirmation();
    return;
  }
  send(selectionCloseCommand(rows));
}

/** Keeps the rows that the state still shows, each time the state changes. */
export function useSelectionPruning() {
  useEffect(() => {
    const prune = () => usePanelSelection.getState().prune(usePanelStore.getState().state);
    prune();
    return usePanelStore.subscribe(prune);
  }, []);
}

/** Escape empties the selection. Delete and Backspace close it. Neither works while a text field has the focus. */
export function useSelectionShortcuts() {
  const { send } = usePanel();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (usePanelSelection.getState().selected.length === 0 || isTextField(event.target)) return;
      // A menu or a dialog takes the key first.
      if (document.querySelector('[role="menu"], [role="alertdialog"]')) return;
      if (event.key === 'Escape') {
        usePanelSelection.getState().clear();
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        closeSelection(send);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [send]);
}
