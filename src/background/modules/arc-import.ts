import { importArcSpace } from '../../shared/arc-import';
import { registerRpc } from '../registry';
import type { WorkerModule } from '../worker-module';
import { addItemsToEmptyStore, getItems } from './item-store';

const arcImport: WorkerModule = {
  name: 'arc-import',
  order: 50,
  start() {
    registerRpc('arc-import/available', async () => (await getItems()).length === 0);
    registerRpc('arc-import/run', async ({ text, spaceId }) => {
      const imported = importArcSpace(text, spaceId);
      if (!imported.ok) return imported;
      // The store checks that it is empty and writes every item in one step.
      if (!(await addItemsToEmptyStore(imported.items))) {
        return {
          ok: false,
          error: 'Sidearc already has items. The Arc import runs only on an empty Sidearc.',
        };
      }
      return { ok: true, report: imported.report };
    });
  },
};
export default arcImport;
