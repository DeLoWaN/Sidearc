import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { TitleField } from './TitleField';

/** The row where the user types the name of a new Folder. A blank name creates nothing. */
export function NewFolderRow({ parentId }: { parentId: string | null }) {
  const { send } = usePanel();
  const stopCreateFolder = usePanelUi((ui) => ui.stopCreateFolder);
  return (
    <li className="flex h-(--row-height) items-center px-2.5">
      <TitleField
        label="Name of the new folder"
        onDone={(title) => {
          if (title) send({ type: 'folder/create', title, parentId });
          stopCreateFolder();
        }}
      />
    </li>
  );
}
