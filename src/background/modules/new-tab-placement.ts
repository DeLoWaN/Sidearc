import { isCreatingTabBySidearc } from '../sidearc-tabs';
import type { WorkerModule } from '../worker-module';
import { getSettings } from './settings';

// An empty address and about:blank are the address of a New Tab page that still loads.
const NEW_TAB_PAGE = /^(|about:blank|chrome:\/\/(newtab|new-tab-page)\/?)$/i;

const isNewTabPage = (tab: chrome.tabs.Tab) => NEW_TAB_PAGE.test(tab.pendingUrl || tab.url || '');

/** Moves a tab that the user opens directly to the start of the tab strip. */
async function placeNewTab(tab: chrome.tabs.Tab) {
  // A tab with an opener comes from a link: Chrome puts it next to the opener.
  if (tab.id === undefined || tab.openerTabId !== undefined || !isNewTabPage(tab)) return;
  if (isCreatingTabBySidearc(tab.windowId)) return;
  if (!(await getSettings()).newTabsOnTop) return;
  // The first tab of a window has no other place to go.
  if ((await browser.tabs.query({ windowId: tab.windowId })).length < 2) return;
  await browser.tabs.move(tab.id, { index: 0 });
}

const newTabPlacement: WorkerModule = {
  name: 'new-tab-placement',
  order: 40,
  start() {
    browser.tabs.onCreated.addListener((tab) => {
      placeNewTab(tab).catch(console.error);
    });
  },
};
export default newTabPlacement;
