import type { TabGroupView } from '../../shared/types';
import { registerCommand } from '../registry';
import { notifySidebarChanged, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';

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

const tabGroups: WorkerModule = {
  name: 'tab-groups',
  order: 21,
  start() {
    registerSidebarSection('tab-groups', async () => ({ tabGroups: await composeTabGroups() }));

    registerCommand('group/toggle', async ({ groupId }) => {
      const group = await browser.tabGroups.get(groupId);
      await browser.tabGroups.update(groupId, { collapsed: !group.collapsed });
    });

    registerCommand('group/add-tab', ({ tabId, groupId }) =>
      browser.tabs.group({ tabIds: [tabId], groupId }),
    );

    registerCommand('group/remove-tab', ({ tabId }) => browser.tabs.ungroup(tabId));

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
