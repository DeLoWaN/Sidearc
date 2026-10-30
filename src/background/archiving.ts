import { iconUrl } from './icons';
import { addArchiveEntries } from './modules/archive-store';
import { getLiveTabs } from './modules/live-tab-registry';
import { createQueue } from './queue';
import { createTabBySidearc } from './sidearc-tabs';

// A Clear and an Auto Archive run must not close the same tab twice.
const closings = createQueue();

// View Archive keeps every tab with an address, except a blank New Tab page and a page of Sidearc.
const isArchivable = (url: string) =>
  url !== '' &&
  url !== 'about:blank' &&
  !/^chrome:\/\/newtab\/?$/i.test(url) &&
  !url.startsWith(browser.runtime.getURL('/'));

/** The open tabs that belong to no Favorite and no Pinned Tab, in tab strip order. */
async function getUnpinnedChromeTabs(): Promise<chrome.tabs.Tab[]> {
  const [tabs, liveTabs] = await Promise.all([browser.tabs.query({}), getLiveTabs()]);
  const liveTabIds = new Set(liveTabs.values());
  return tabs.filter((tab) => !liveTabIds.has(tab.id as number));
}

/**
 * Puts the tabs in View Archive, then closes them. A window that would lose all its tabs
 * gets a blank tab first, because Chrome closes an empty window and the browser with it.
 * `choose` runs on the Unpinned Tabs at the moment of closing, never on an older list.
 */
export function closeAndArchive(choose: (tabs: chrome.tabs.Tab[]) => chrome.tabs.Tab[]) {
  return closings.run(async () => {
    const tabs = choose(await getUnpinnedChromeTabs());
    if (tabs.length === 0) return;

    await addArchiveEntries(
      tabs
        .filter((tab) => isArchivable(tab.url ?? ''))
        .map((tab) => ({
          url: tab.url as string,
          title: tab.title || (tab.url as string),
          iconUrl: iconUrl(tab.url as string, tab.favIconUrl),
        })),
    );

    const closing = new Set(tabs.map((tab) => tab.id as number));
    const open = await browser.tabs.query({});
    const emptied = [...new Set(tabs.map((tab) => tab.windowId))].filter((windowId) =>
      open.every((tab) => tab.windowId !== windowId || closing.has(tab.id as number)),
    );
    for (const windowId of emptied) await createTabBySidearc({ windowId, active: true });

    await browser.tabs.remove([...closing]);
  });
}
