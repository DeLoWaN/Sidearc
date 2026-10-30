import { ItemMenu } from '../components/ItemMenu';
import { ViewArchive } from '../components/ViewArchive';

/** The right-click menu of items and View Archive. Ticket #5 adds the confirm dialog. */
export function Overlays() {
  return (
    <>
      <ItemMenu />
      <ViewArchive />
    </>
  );
}
