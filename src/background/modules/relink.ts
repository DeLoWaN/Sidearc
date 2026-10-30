import { createQueue } from '../queue';
import type { WorkerModule } from '../worker-module';
import { getItems } from './item-store';
import { getLiveTabs, linkLiveTab } from './live-tab-registry';

const STORAGE_KEY = 'relink';

/** Restored tabs that had no URL yet at the last pass. Session storage is empty until the first pass. */
type RelinkState = { waiting: number[] };

const passes = createQueue();

const urlOf = (tab: chrome.tabs.Tab) => tab.url || tab.pendingUrl || undefined;

async function readState(): Promise<RelinkState | undefined> {
  const stored = await browser.storage.session.get(STORAGE_KEY);
  return stored[STORAGE_KEY] as RelinkState | undefined;
}

const writeState = (state: RelinkState) => browser.storage.session.set({ [STORAGE_KEY]: state });

/** Links each tab, in the given order, to the first item at rest with the same URL. */
async function linkByUrl(tabs: chrome.tabs.Tab[]) {
  const [items, liveTabs] = await Promise.all([getItems(), getLiveTabs()]);
  const linkedTabs = new Set(liveTabs.values());
  const atRest = items.filter((item) => !liveTabs.has(item.id));
  for (const tab of tabs) {
    if (linkedTabs.has(tab.id as number)) continue;
    const item = atRest.find((candidate) => candidate.url === urlOf(tab));
    if (!item) continue;
    atRest.splice(atRest.indexOf(item), 1);
    await linkLiveTab(item.id, tab.id as number);
  }
}

/** Links every open tab that has a URL. Remembers the tabs that have none. */
function relinkOpenTabs() {
  return passes.run(async () => {
    const tabs = await browser.tabs.query({});
    await linkByUrl(tabs.filter(urlOf));
    await writeState({ waiting: tabs.filter((tab) => !urlOf(tab)).map((tab) => tab.id as number) });
  });
}

/** Links a restored tab when its URL arrives after the pass. */
function relinkLoadedTab(tab: chrome.tabs.Tab) {
  return passes.run(async () => {
    const state = await readState();
    if (!state?.waiting.includes(tab.id as number) || !urlOf(tab)) return;
    await writeState({ waiting: state.waiting.filter((id) => id !== tab.id) });
    await linkByUrl([tab]);
  });
}

const relink: WorkerModule = {
  name: 'relink',
  order: 25,
  start() {
    // Chrome restores the tabs of the last session when it starts: no link survives it.
    browser.runtime.onStartup.addListener(() => relinkOpenTabs().catch(console.error));

    browser.tabs.onUpdated.addListener((_tabId, change, tab) => {
      if (change.url || change.status) relinkLoadedTab(tab).catch(console.error);
    });

    // An empty session storage means that Chrome or the extension started just now.
    readState()
      .then((state) => (state ? undefined : relinkOpenTabs()))
      .catch(console.error);
  },
};
export default relink;
