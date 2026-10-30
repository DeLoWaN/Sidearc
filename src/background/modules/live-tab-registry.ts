import { createQueue } from '../queue';
import { notifyOnStorageChange } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';
import { getItems } from './item-store';

export const LIVE_TABS_STORAGE_KEY = 'liveTabs';

/** Item id to the id of its live tab. Session storage keeps it when the worker stops, not when Chrome quits. */
type Links = Record<string, number>;

const writes = createQueue();

async function readLinks(): Promise<Links> {
  const stored = await browser.storage.session.get(LIVE_TABS_STORAGE_KEY);
  return (stored[LIVE_TABS_STORAGE_KEY] as Links | undefined) ?? {};
}

async function change(update: (links: Links) => Links | Promise<Links>) {
  await writes.run(async () => {
    await browser.storage.session.set({ [LIVE_TABS_STORAGE_KEY]: await update(await readLinks()) });
  });
}

/** Keeps the links whose tab is open and whose item exists. */
async function withoutDeadLinks(links: Links): Promise<Links> {
  const [tabs, items] = await Promise.all([browser.tabs.query({}), getItems()]);
  const openTabs = new Set(tabs.map((tab) => tab.id));
  const knownItems = new Set(items.map((item) => item.id));
  return Object.fromEntries(
    Object.entries(links).filter(
      ([itemId, tabId]) => openTabs.has(tabId) && knownItems.has(itemId),
    ),
  );
}

/** Item id to tab id for every item with an open live tab. */
export async function getLiveTabs(): Promise<Map<string, number>> {
  return new Map(Object.entries(await withoutDeadLinks(await readLinks())));
}

/** Makes the tab the live tab of the item. A tab belongs to one item at most. */
export function linkLiveTab(itemId: string, tabId: number) {
  return change((links) => {
    const others = Object.entries(links).filter(([, linked]) => linked !== tabId);
    return { ...Object.fromEntries(others), [itemId]: tabId };
  });
}

/** Puts every item at rest. */
export function clearLiveTabs() {
  return change(() => ({}));
}

const forgetDeadLinks = () => change(withoutDeadLinks);

const liveTabRegistry: WorkerModule = {
  name: 'live-tab-registry',
  order: 20,
  start() {
    browser.tabs.onRemoved.addListener(() => forgetDeadLinks().catch(console.error));
    browser.windows.onRemoved.addListener(() => forgetDeadLinks().catch(console.error));

    // Chrome swaps a tab for another one, for example after a prerender. The item keeps its link.
    browser.tabs.onReplaced.addListener((added, removed) => {
      change((links) =>
        Object.fromEntries(
          Object.entries(links).map(([itemId, tabId]) => [
            itemId,
            tabId === removed ? added : tabId,
          ]),
        ),
      ).catch(console.error);
    });

    notifyOnStorageChange('session', LIVE_TABS_STORAGE_KEY);
  },
};
export default liveTabRegistry;
