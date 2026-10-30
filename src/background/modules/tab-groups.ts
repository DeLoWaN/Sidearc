import type { TabGroupView } from '../../shared/types';
import { registerCommand } from '../registry';
import { notifySidebarChanged, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';
import { getLiveTabs } from './live-tab-registry';

async function composeTabGroups(): Promise<TabGroupView[]> {
  const [groups, tabs] = await Promise.all([browser.tabGroups.query({}), browser.tabs.query({})]);
  tabs.sort((a, b) => a.windowId - b.windowId || a.index - b.index);
  const views = groups.map((group) => ({
    id: group.id,
    windowId: group.windowId,
    title: group.title ?? '',
    color: group.color,
    collapsed: group.collapsed,
    tabIds: tabs.filter((tab) => tab.groupId === group.id).map((tab) => tab.id as number),
  }));
  const firstTab = (view: TabGroupView) => tabs.findIndex((tab) => tab.id === view.tabIds[0]);
  return views.sort((a, b) => firstTab(a) - firstTab(b));
}

/** Puts the tab at the end of the Tab group. The tab changes window when the group is in another one. */
export const addTabToGroup = (tabId: number, groupId: number) =>
  browser.tabs.group({ tabIds: [tabId], groupId });

/**
 * The Tab group and its tabs in tab strip order, without the live tabs of Pinned Tabs and Favorites.
 * These are the tabs that the panel shows in the block. Undefined when the group does not exist or shows no tab.
 */
export async function shownTabGroup(groupId: number) {
  const group = await browser.tabGroups.get(groupId).catch(() => undefined);
  if (!group) return undefined;
  const [tabs, live] = await Promise.all([browser.tabs.query({ groupId }), getLiveTabs()]);
  const liveIds = new Set(live.values());
  const shown = tabs
    .filter((tab) => !liveIds.has(tab.id as number))
    .sort((a, b) => a.windowId - b.windowId || a.index - b.index);
  return shown.length > 0 ? { group, tabs: shown } : undefined;
}

/**
 * Puts the new tabs, which sit in the window, back in a Tab group.
 * The tabs join the group `original` when it still exists in that window, for example for a live tab that stayed in it.
 * Otherwise a new group gets the title, the colour and the collapsed state of `original`.
 */
export async function restoreTabGroup(
  tabIds: [number, ...number[]],
  windowId: number,
  original: Pick<chrome.tabGroups.TabGroup, 'id' | 'title' | 'color' | 'collapsed'>,
) {
  const existing = await browser.tabGroups.get(original.id).catch(() => undefined);
  if (existing?.windowId === windowId) {
    await browser.tabs.group({ tabIds, groupId: existing.id });
    return;
  }
  const groupId = await browser.tabs.group({ tabIds, createProperties: { windowId } });
  await browser.tabGroups.update(groupId, {
    title: original.title,
    color: original.color,
    collapsed: original.collapsed,
  });
}

export const removeTabFromGroup = (tabId: number) => browser.tabs.ungroup(tabId);

const tabGroups: WorkerModule = {
  name: 'tab-groups',
  order: 21,
  start() {
    registerSidebarSection('tab-groups', async () => ({ tabGroups: await composeTabGroups() }));

    registerCommand('group/toggle', async ({ groupId }) => {
      const group = await browser.tabGroups.get(groupId);
      await browser.tabGroups.update(groupId, { collapsed: !group.collapsed });
    });

    registerCommand('group/close', async ({ groupId }) => {
      const shown = await shownTabGroup(groupId);
      if (shown) await browser.tabs.remove(shown.tabs.map((tab) => tab.id as number));
    });

    registerCommand('group/add-tab', ({ tabId, groupId }) => addTabToGroup(tabId, groupId));

    registerCommand('group/remove-tab', ({ tabId }) => removeTabFromGroup(tabId));

    // A tab joins or leaves a group through tabs.onUpdated, so the tab events matter too.
    const { tabs, tabGroups } = browser;
    for (const event of [
      tabGroups.onCreated,
      tabGroups.onUpdated,
      tabGroups.onRemoved,
      tabGroups.onMoved,
      tabs.onUpdated,
      tabs.onCreated,
      tabs.onRemoved,
      tabs.onMoved,
      tabs.onAttached,
      tabs.onDetached,
    ]) {
      (event as { addListener(listener: () => void): void }).addListener(notifySidebarChanged);
    }
  },
};
export default tabGroups;
