import { useEffect } from 'react';
import { usePanel } from './panel-context';
import { usePanelStore } from './store';

/** True when the target takes typed text: an input, a text area, a select, or an element that the user edits. */
export const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Sends `undo` on Ctrl+Z or Cmd+Z while the panel has the focus, unless the focus is in a text field.
 * The browser keeps Ctrl+Z for itself outside the panel, so the Undo button is the main way.
 */
export function useUndoShortcut() {
  const { send } = usePanel();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const undo = event.ctrlKey || event.metaKey;
      if (!undo || event.shiftKey || event.altKey || event.key.toLowerCase() !== 'z') return;
      if (isTextField(event.target) || !usePanelStore.getState().state.undo) return;
      event.preventDefault();
      send({ type: 'undo' });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [send]);
}
