import type { ItemRecord, ItemView } from '../../shared/types';
import { iconUrl } from '../icons';
import { registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';
import { getItems } from './item-store';
import { getLiveTabs } from './live-tab-registry';

function toItemView(item: ItemRecord, tab: chrome.tabs.Tab | undefined): ItemView {
  if (!tab) return { ...item, iconUrl: iconUrl(item.url) };
  return {
    ...item,
    iconUrl: iconUrl(item.url, tab.favIconUrl),
    live: {
      tabId: tab.id as number,
      windowId: tab.windowId,
      title: tab.title || tab.url || '',
      active: tab.active,
      // A tab that has not loaded yet has no URL: it is not away.
      away: Boolean(tab.url) && tab.url !== item.url,
    },
  };
}

const itemsSection: WorkerModule = {
  name: 'items-section',
  order: 25,
  start() {
    registerSidebarSection('items', async () => {
      const [items, liveTabs, tabs] = await Promise.all([
        getItems(),
        getLiveTabs(),
        browser.tabs.query({}),
      ]);
      const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
      return {
        items: items.map((item) => toItemView(item, tabById.get(liveTabs.get(item.id)))),
      };
    });
  },
};
export default itemsSection;
