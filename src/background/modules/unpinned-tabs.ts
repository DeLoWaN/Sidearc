import type { TabView } from '../../shared/types';
import { notifySidebarChanged, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';

/** The page icon when Chrome knows it, else the Chrome cache of site icons (permission `favicon`). */
function iconUrl(tab: chrome.tabs.Tab): string {
  if (tab.favIconUrl) return tab.favIconUrl;
  const cache = new URL(browser.runtime.getURL('/_favicon/' as never));
  cache.searchParams.set('pageUrl', tab.url ?? '');
  cache.searchParams.set('size', '32');
  return cache.toString();
}

function toTabView(tab: chrome.tabs.Tab): TabView {
  return {
    id: tab.id as number,
    windowId: tab.windowId,
    index: tab.index,
    title: tab.title || tab.url || '',
    url: tab.url ?? '',
    iconUrl: iconUrl(tab),
    active: tab.active,
  };
}

const unpinnedTabs: WorkerModule = {
  name: 'unpinned-tabs',
  order: 20,
  start() {
    registerSidebarSection('unpinned-tabs', async () => {
      const tabs = await browser.tabs.query({});
      tabs.sort((a, b) => a.windowId - b.windowId || a.index - b.index);
      return { unpinnedTabs: tabs.map(toTabView) };
    });

    const { tabs, windows } = browser;
    for (const event of [
      tabs.onCreated,
      tabs.onRemoved,
      tabs.onUpdated,
      tabs.onMoved,
      tabs.onAttached,
      tabs.onDetached,
      tabs.onReplaced,
      tabs.onActivated,
      windows.onRemoved,
    ]) {
      (event as { addListener(listener: () => void): void }).addListener(notifySidebarChanged);
    }
  },
};
export default unpinnedTabs;
