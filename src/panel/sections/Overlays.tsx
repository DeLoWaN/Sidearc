import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { ItemMenu } from '../components/ItemMenu';
import { ItemMoveMenu } from '../components/ItemMoveMenu';
import { Notice } from '../components/Notice';
import { ViewArchive } from '../components/ViewArchive';

/** The right-click menu of items, the Move to… menu, the delete confirmation, notices and View Archive. */
export function Overlays() {
  return (
    <>
      <ItemMenu />
      <ItemMoveMenu />
      <ConfirmDeleteDialog />
      <Notice />
      <ViewArchive />
    </>
  );
}
