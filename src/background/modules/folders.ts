import { isFolderOrRoot } from '../../shared/item-tree';
import { registerCommand } from '../registry';
import type { WorkerModule } from '../worker-module';
import { addItem, getItems, moveItem, toggleFolder } from './item-store';

const folders: WorkerModule = {
  name: 'folders',
  order: 12,
  start() {
    registerCommand('folder/create', async ({ title, parentId }) => {
      const name = title.trim();
      if (!name || !isFolderOrRoot(await getItems(), parentId)) return;
      await addItem({ kind: 'folder', title: name, url: '', parentId });
    });

    registerCommand('folder/toggle', ({ itemId }) => toggleFolder(itemId));

    registerCommand('item/move', ({ itemId, parentId }) => moveItem(itemId, parentId));
  },
};
export default folders;
