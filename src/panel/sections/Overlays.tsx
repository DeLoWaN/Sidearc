import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { ItemMenu } from '../components/ItemMenu';

/** The right-click menu of items and the delete confirmation. Ticket #10 adds View Archive. */
export function Overlays() {
  return (
    <>
      <ItemMenu />
      <ConfirmDeleteDialog />
    </>
  );
}
