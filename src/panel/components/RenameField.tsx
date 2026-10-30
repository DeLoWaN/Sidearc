import type { ItemView } from '../../shared/types';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { TitleField } from './TitleField';

/** The field that replaces the title while the user renames the item. */
export function RenameField({ item }: { item: ItemView }) {
  const { send } = usePanel();
  const stopRename = usePanelUi((ui) => ui.stopRename);
  return (
    <TitleField
      label={`Name of ${item.title}`}
      initial={item.title}
      onDone={(title) => {
        if (title && title !== item.title) send({ type: 'item/rename', itemId: item.id, title });
        stopRename();
      }}
    />
  );
}
