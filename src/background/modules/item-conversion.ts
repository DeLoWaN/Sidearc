import { registerCommand } from '../registry';
import type { WorkerModule } from '../worker-module';
import { deleteItem, getItems } from './item-store';
import { getLiveTabs } from './live-tab-registry';
import { itemActions, pinTab } from './tab-actions';

/**
 * Deletes a Pinned Tab and keeps it as an Unpinned Tab: its live tab stays open,
 * or its saved URL opens in a new tab of the window. Does nothing for a Folder.
 * Runs inside `itemActions`: never call it from another task of that queue.
 */
export async function unpinItem(itemId: string, windowId: number) {
  const item = (await getItems()).find((candidate) => candidate.id === itemId);
  if (!item || item.kind === 'folder') return;
  const hasLiveTab = (await getLiveTabs()).has(itemId);
  await deleteItem(itemId);
  if (!hasLiveTab) await browser.tabs.create({ windowId, url: item.url, active: false });
}

const itemConversion: WorkerModule = {
  name: 'item-conversion',
  order: 31,
  start() {
    registerCommand('item/from-tab', async ({ tabId, kind, parentId, index }) => {
      const tab = await browser.tabs.get(tabId);
      await pinTab(tab, { kind, parentId: kind === 'favorite' ? null : parentId, index });
    });

    registerCommand('item/unpin', ({ itemId, windowId }) =>
      itemActions.run(() => unpinItem(itemId, windowId)),
    );
  },
};
export default itemConversion;
