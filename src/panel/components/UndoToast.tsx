import { useEffect } from 'react';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { CloseIcon } from './CloseIcon';

const SHOW_MS = 8000;

/** Tells the user what just went, with an Undo button. It hides after a few seconds. */
export function UndoToast() {
  const { send } = usePanel();
  const message = usePanelUi((ui) => ui.undoToast);
  const dismiss = usePanelUi((ui) => ui.dismissUndoToast);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(dismiss, SHOW_MS);
    return () => clearTimeout(timer);
  }, [message, dismiss]);

  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-2.5 bottom-12 z-20 flex items-center gap-2 rounded-xl bg-(--menu-bg) px-3 py-2 shadow-lg"
    >
      <span className="min-w-0 flex-1 truncate">{message}</span>
      <button
        type="button"
        onClick={() => {
          dismiss();
          send({ type: 'undo' });
        }}
        className="shrink-0 rounded-md px-2 py-0.5 font-medium hover:bg-(--row-hover)"
      >
        Undo
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="grid size-5 shrink-0 place-items-center rounded-md text-(--text-muted) hover:bg-(--row-hover)"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
