import { createQueue } from '../queue';
import { notifyOnStorageChange } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';

export const UNVISITED_TABS_STORAGE_KEY = 'unvisitedTabs';

const writes = createQueue();

async function readIds(): Promise<number[]> {
  const stored = await browser.storage.session.get(UNVISITED_TABS_STORAGE_KEY);
  return (stored[UNVISITED_TABS_STORAGE_KEY] as number[] | undefined) ?? [];
}

function change(update: (ids: number[]) => number[]) {
  return writes
    .run(async () => {
      await browser.storage.session.set({ [UNVISITED_TABS_STORAGE_KEY]: update(await readIds()) });
    })
    .catch(console.error);
}

const forget = (tabId: number) => change((ids) => ids.filter((id) => id !== tabId));

/** The ids of the tabs that opened in the background from another tab and that nobody showed yet. */
export async function getUnvisitedTabIds(): Promise<Set<number>> {
  return new Set(await readIds());
}

const unvisitedTabs: WorkerModule = {
  name: 'unvisited-tabs',
  order: 10,
  start() {
    browser.tabs.onCreated.addListener((tab) => {
      // A tab without an opener comes from Chrome itself or from Sidearc, not from a link.
      if (tab.active || tab.id === undefined || tab.openerTabId === undefined) return;
      const tabId = tab.id;
      change((ids) => [...ids.filter((id) => id !== tabId), tabId]);
    });
    browser.tabs.onActivated.addListener(({ tabId }) => forget(tabId));
    browser.tabs.onUpdated.addListener((tabId, changes) => {
      // The Chrome types do not list `active` in the changes of this event.
      if ((changes as { active?: boolean }).active) forget(tabId);
    });
    browser.tabs.onRemoved.addListener((tabId) => forget(tabId));

    notifyOnStorageChange('session', UNVISITED_TABS_STORAGE_KEY);
  },
};
export default unvisitedTabs;
