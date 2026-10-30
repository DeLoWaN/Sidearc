import { isNewTabPageUrl } from '../../shared/url';
import { moveAfterLastMember } from '../group-end';
import type { WorkerModule } from '../worker-module';

const NO_GROUP = -1; // chrome.tabGroups.TAB_GROUP_ID_NONE

/** Puts the tab after the last tab of the Tab group, and in the group. */
async function moveToEndOfTabGroup(tabId: number, groupId: number) {
  const members = await browser.tabs.query({ groupId });
  await moveAfterLastMember(
    tabId,
    members.map((member) => member.id as number),
  );
  // The move can take the tab out of the group.
  if ((await browser.tabs.get(tabId)).groupId !== groupId)
    await browser.tabs.group({ tabIds: [tabId], groupId });
}

/** Puts a tab that opens from a tab of a Tab group at the end of the group, as Chrome puts it next to its opener. */
async function placeOpenedTab(tab: chrome.tabs.Tab) {
  if (tab.id === undefined || tab.openerTabId === undefined) return;
  // A New Tab page is the place of the new-tab-placement module.
  if (isNewTabPageUrl(tab.pendingUrl || tab.url || '')) return;
  const opener = await browser.tabs.get(tab.openerTabId).catch(() => undefined);
  if (!opener || opener.windowId !== tab.windowId || (opener.groupId ?? NO_GROUP) === NO_GROUP)
    return;
  await moveToEndOfTabGroup(tab.id, opener.groupId);
}

const tabGroupEnd: WorkerModule = {
  name: 'tab-group-end',
  order: 41,
  start() {
    browser.tabs.onCreated.addListener((tab) => {
      placeOpenedTab(tab).catch(console.error);
    });
  },
};
export default tabGroupEnd;
