import { createQueue } from '../queue';
import { registerCommand } from '../registry';
import type { WorkerModule } from '../worker-module';
import { addItem, getItems } from './item-store';
import { getLiveTabs, linkLiveTab } from './live-tab-registry';

// "Is there a live tab?" and "make one" must not overlap, or two clicks would open two tabs.
export const itemActions = createQueue();

// Tab Handoff: the tab moves to the window of the panel. It never reloads or duplicates.
async function showTab(tabId: number, windowId: number) {
  const tab = await browser.tabs.get(tabId);
  if (tab.windowId !== windowId) await browser.tabs.move(tabId, { windowId, index: -1 });
  await browser.tabs.update(tabId, { active: true });
}

/** Where a new item goes. The index counts the items of the parent. */
export interface Placement {
  kind: 'pinned' | 'favorite';
  parentId: string | null;
  index?: number;
}

/**
 * Saves the tab as an item, at the end of the root as a Pinned Tab unless the placement says otherwise.
 * The tab becomes its live tab. Does nothing for a tab that already has an item.
 * Throws when the placement is not valid, for example a 13th Favorite.
 */
export function pinTab(
  tab: chrome.tabs.Tab,
  placement: Placement = { kind: 'pinned', parentId: null },
) {
  return itemActions.run(async () => {
    const url = tab.url || tab.pendingUrl;
    if (tab.id === undefined || !url) return;
    const linked = await getLiveTabs();
    if ([...linked.values()].includes(tab.id)) return;
    const item = await addItem({ ...placement, title: tab.title || url, url });
    await linkLiveTab(item.id, tab.id);
  });
}

const tabActions: WorkerModule = {
  name: 'tab-actions',
  order: 30,
  start() {
    registerCommand('tab/activate', ({ tabId, windowId }) => showTab(tabId, windowId));

    registerCommand('tab/close', ({ tabId }) => browser.tabs.remove(tabId));

    // Without a window id, Chrome keeps the tab in its own window.
    registerCommand('tab/move', ({ tabId, index }) => browser.tabs.move(tabId, { index }));

    registerCommand('item/open', ({ itemId, windowId }) =>
      itemActions.run(async () => {
        const liveTabId = (await getLiveTabs()).get(itemId);
        if (liveTabId !== undefined) return showTab(liveTabId, windowId);
        const item = (await getItems()).find((candidate) => candidate.id === itemId);
        if (!item) return;
        const tab = await browser.tabs.create({ windowId, url: item.url, active: true });
        await linkLiveTab(item.id, tab.id as number);
      }),
    );

    registerCommand('item/reset', async ({ itemId }) => {
      const tabId = (await getLiveTabs()).get(itemId);
      const item = (await getItems()).find((candidate) => candidate.id === itemId);
      if (tabId !== undefined && item) await browser.tabs.update(tabId, { url: item.url });
    });
  },
};
export default tabActions;
