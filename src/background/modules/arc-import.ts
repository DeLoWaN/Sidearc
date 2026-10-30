import { importArcSpace } from '../../shared/arc-import';
import { registerRpc } from '../registry';
import { notifySidebarChanged } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';
import { getItems, replaceItems } from './item-store';
import { clearLiveTabs } from './live-tab-registry';
import { relinkOpenTabs } from './relink';
import { undoableItemsChange } from './undo';

const arcImport: WorkerModule = {
  name: 'arc-import',
  order: 50,
  start() {
    registerRpc('arc-import/status', async () => ({ itemCount: (await getItems()).length }));
    registerRpc('arc-import/run', async ({ text, spaceId }) => {
      // A refused file stops here, before anything changes.
      const imported = importArcSpace(text, spaceId);
      if (!imported.ok) return imported;

      await undoableItemsChange('Import from Arc', async () => {
        // One write replaces every item. Each item is at rest after it, then each open tab with the saved URL of an item becomes its live tab.
        await replaceItems(imported.items);
        await clearLiveTabs();
        await relinkOpenTabs();
        notifySidebarChanged();
      });
      return { ok: true, report: imported.report };
    });
  },
};
export default arcImport;
