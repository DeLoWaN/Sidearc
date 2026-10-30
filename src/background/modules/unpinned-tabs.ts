import type { TabView } from '../../shared/types';
import { iconUrl } from '../icons';
import { notifySidebarChanged, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';
import { getLiveTabs } from './live-tab-registry';
import { getUnvisitedTabIds } from './unvisited-tabs';

function toTabView(tab: chrome.tabs.Tab, unvisited: Set<number>): TabView {
  return {
    id: tab.id as number,
    windowId: tab.windowId,
    index: tab.index,
    title: tab.title || tab.url || '',
    url: tab.url ?? '',
    iconUrl: iconUrl(tab.url ?? '', tab.favIconUrl),
    active: tab.active,
    unvisited: unvisited.has(tab.id as number),
  };
}

const unpinnedTabs: WorkerModule = {
  name: 'unpinned-tabs',
  order: 20,
  start() {
    registerSidebarSection('unpinned-tabs', async () => {
      const [allTabs, liveTabs, unvisited] = await Promise.all([
        browser.tabs.query({}),
        getLiveTabs(),
        getUnvisitedTabIds(),
      ]);
      const liveTabIds = new Set(liveTabs.values());
      const tabs = allTabs.filter((tab) => !liveTabIds.has(tab.id as number));
      tabs.sort((a, b) => a.windowId - b.windowId || a.index - b.index);
      return { unpinnedTabs: tabs.map((tab) => toTabView(tab, unvisited)) };
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
