import { createQueue } from '../queue';
import { registerCommand } from '../registry';
import type { WorkerModule } from '../worker-module';
import { addItem, getItems } from './item-store';
import { getLiveTabs, linkLiveTab } from './live-tab-registry';

// "Is there a live tab?" and "make one" must not overlap, or two clicks would open two tabs.
const itemActions = createQueue();

async function showTab(tabId: number, windowId: number) {
  const tab = await browser.tabs.update(tabId, { active: true });
  // The panel window is already focused: only another window needs the focus.
  if (tab?.windowId !== undefined && tab.windowId !== windowId) {
    await browser.windows.update(tab.windowId, { focused: true });
  }
}

/** Saves the tab as a Pinned Tab at the root, and makes the tab its live tab. Does nothing for a tab that already has an item. */
export function pinTab(tab: chrome.tabs.Tab) {
  return itemActions.run(async () => {
    const url = tab.url || tab.pendingUrl;
    if (tab.id === undefined || !url) return;
    const linked = await getLiveTabs();
    if ([...linked.values()].includes(tab.id)) return;
    const item = await addItem({ kind: 'pinned', title: tab.title || url, url });
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
