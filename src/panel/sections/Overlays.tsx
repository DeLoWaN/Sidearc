import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { ItemMenu } from '../components/ItemMenu';
import { Notice } from '../components/Notice';
import { ViewArchive } from '../components/ViewArchive';

/** The right-click menu of items, the delete confirmation, notices and View Archive. */
export function Overlays() {
  return (
    <>
      <ItemMenu />
      <ConfirmDeleteDialog />
      <Notice />
      <ViewArchive />
    </>
  );
}
