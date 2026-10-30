import { useEffect } from 'react';
import { usePanelUi } from '../ui-store';
import { CloseIcon } from './CloseIcon';

const SHOW_MS = 5000;

/** A short message from the worker. It hides after a few seconds, or when the user dismisses it. */
export function Notice() {
  const notice = usePanelUi((ui) => ui.notice);
  const dismissNotice = usePanelUi((ui) => ui.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, SHOW_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-2.5 bottom-12 z-20 flex items-center gap-2 rounded-xl bg-(--menu-bg) px-3 py-2 shadow-lg"
    >
      <span className="min-w-0 flex-1">{notice}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissNotice}
        className="grid size-5 shrink-0 place-items-center rounded-md text-(--text-muted) hover:bg-(--row-hover)"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
