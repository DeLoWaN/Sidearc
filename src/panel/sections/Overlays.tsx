import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { ConfirmSelectionDialog } from '../components/ConfirmSelectionDialog';
import { ItemMenu } from '../components/ItemMenu';
import { Notice } from '../components/Notice';
import { SelectionMenu } from '../components/SelectionMenu';
import { UndoToast } from '../components/UndoToast';
import { ViewArchive } from '../components/ViewArchive';

/** The right-click menus of items and of the selection, the delete confirmations, notices, the Undo toast and View Archive. */
export function Overlays() {
  return (
    <>
      <ItemMenu />
      <SelectionMenu />
      <ConfirmDeleteDialog />
      <ConfirmSelectionDialog />
      <Notice />
      <UndoToast />
      <ViewArchive />
    </>
  );
}
