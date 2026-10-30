import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { ItemMenu } from '../components/ItemMenu';
import { ItemMoveMenu } from '../components/ItemMoveMenu';

/** The right-click menu of items and the delete confirmation. Ticket #10 adds View Archive. */
export function Overlays() {
  return (
    <>
      <ItemMenu />
      <ItemMoveMenu />
      <ConfirmDeleteDialog />
    </>
  );
}
