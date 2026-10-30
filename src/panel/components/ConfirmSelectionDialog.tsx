import { countBelow } from '../../shared/item-tree';
import { plural } from '../../shared/plural';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { selectionCloseCommand } from '../commands';
import { usePanel } from '../panel-context';
import { chosenCount, chosenRows } from '../selection';
import { usePanelSelection } from '../selection-store';
import { usePanelStore } from '../store';

/** Asks the user to confirm the close of a selection that holds a Folder with items in it. */
export function ConfirmSelectionDialog() {
  const { send } = usePanel();
  const { confirmingClose, selected, cancelCloseConfirmation } = usePanelSelection();
  const state = usePanelStore((store) => store.state);
  const rows = chosenRows(state, selected);
  if (!confirmingClose || chosenCount(rows) === 0) return null;
  const count = chosenCount(rows);
  const folders = rows.itemIds.filter((id) => countBelow(state.items, id) > 0).length;

  return (
    <ConfirmDialog
      label={`Close ${plural(count, 'item')}?`}
      confirmLabel="Close"
      onCancel={cancelCloseConfirmation}
      onConfirm={() => {
        cancelCloseConfirmation();
        send(selectionCloseCommand(rows));
      }}
    >
      Close {plural(count, 'item')}? This includes {plural(folders, 'Folder')} with{' '}
      {folders === 1 ? 'its' : 'their'} content.
    </ConfirmDialog>
  );
}
