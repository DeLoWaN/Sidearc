import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { ItemMenu } from '../components/ItemMenu';
import { Notice } from '../components/Notice';
import { UndoToast } from '../components/UndoToast';
import { ViewArchive } from '../components/ViewArchive';

/** The right-click menu of items, the delete confirmation, notices, the Undo toast and View Archive. */
export function Overlays() {
  return (
    <>
      <ItemMenu />
      <ConfirmDeleteDialog />
      <Notice />
      <UndoToast />
      <ViewArchive />
    </>
  );
}
