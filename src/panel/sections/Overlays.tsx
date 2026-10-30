import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { ItemMenu } from '../components/ItemMenu';
import { ItemMoveMenu } from '../components/ItemMoveMenu';
import { Notice } from '../components/Notice';
import { UndoToast } from '../components/UndoToast';
import { ViewArchive } from '../components/ViewArchive';

/** The right-click menu of items, the Move to… menu, the delete confirmation, notices, the Undo toast and View Archive. */
export function Overlays() {
  return (
    <>
      <ItemMenu />
      <ItemMoveMenu />
      <ConfirmDeleteDialog />
      <Notice />
      <UndoToast />
      <ViewArchive />
    </>
  );
}
