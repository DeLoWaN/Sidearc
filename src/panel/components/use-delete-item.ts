import { countBelow } from '../../shared/item-tree';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';

/**
 * Returns the function that deletes an item for the user.
 * A Folder that holds items asks for a confirmation first, because its content goes with it.
 */
export function useDeleteItem() {
  const { send } = usePanel();
  const askDeleteConfirmation = usePanelUi((ui) => ui.askDeleteConfirmation);
  return (itemId: string) => {
    const { items } = usePanelStore.getState().state;
    if (countBelow(items, itemId) > 0) askDeleteConfirmation(itemId);
    else send({ type: 'item/delete', itemId });
  };
}
