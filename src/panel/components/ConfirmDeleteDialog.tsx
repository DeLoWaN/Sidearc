import { countBelow } from '../../shared/item-tree';
import { plural } from '../../shared/plural';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';

/** Asks the user to confirm the deletion of a Folder that is not empty. */
export function ConfirmDeleteDialog() {
  const { send } = usePanel();
  const { confirmingDeleteId, cancelDelete } = usePanelUi();
  const items = usePanelStore((store) => store.state.items);
  const folder = items.find((item) => item.id === confirmingDeleteId);

  if (!folder) return null;

  return (
    <ConfirmDialog
      label={`Delete ${folder.title}?`}
      confirmLabel="Delete"
      onCancel={cancelDelete}
      onConfirm={() => {
        cancelDelete();
        send({ type: 'item/delete', itemId: folder.id });
      }}
    >
      This deletes the Folder and its {plural(countBelow(items, folder.id), 'item')}. The open tabs
      stay open.
    </ConfirmDialog>
  );
}
