import { useEffect } from 'react';
import { countBelow } from '../../shared/item-tree';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';

/** Asks the user to confirm the deletion of a Folder that is not empty. */
export function ConfirmDeleteDialog() {
  const { send } = usePanel();
  const { confirmingDeleteId, cancelDelete } = usePanelUi();
  const items = usePanelStore((store) => store.state.items);
  const folder = items.find((item) => item.id === confirmingDeleteId);

  useEffect(() => {
    if (!confirmingDeleteId) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && cancelDelete();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmingDeleteId, cancelDelete]);

  if (!folder) return null;
  const count = countBelow(items, folder.id);
  const button = 'rounded-md px-3 py-1.5 hover:bg-(--row-hover)';

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/30 p-4">
      <div
        role="alertdialog"
        aria-label={`Delete ${folder.title}?`}
        aria-describedby="confirm-delete-text"
        className="w-full max-w-72 rounded-xl bg-(--menu-bg) p-4 shadow-lg"
      >
        <p id="confirm-delete-text" className="mb-3">
          This deletes the Folder and its {count} {count === 1 ? 'item' : 'items'}. The open tabs
          stay open.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            // biome-ignore lint/a11y/noAutofocus: the safe answer takes the focus, so Enter never deletes by accident.
            autoFocus
            className={button}
            onClick={cancelDelete}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${button} font-semibold text-red-600`}
            onClick={() => {
              cancelDelete();
              send({ type: 'item/delete', itemId: folder.id });
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
