import { ClearDivider } from '../components/ClearDivider';
import { TabGroupBlock } from '../components/TabGroupBlock';
import { TabRow } from '../components/TabRow';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { arrangeUnpinned } from '../tab-groups';

/** The Unpinned Tabs of all windows, in tab strip order. The active tab of this window is highlighted. */
export function UnpinnedSection() {
  const { windowId } = usePanel();
  const tabs = usePanelStore((store) => store.state.unpinnedTabs);
  const groups = usePanelStore((store) => store.state.tabGroups);
  return (
    <section aria-label="Unpinned Tabs">
      <ClearDivider disabled={tabs.length === 0} />
      <ul>
        {arrangeUnpinned(tabs, groups).map((entry) =>
          entry.kind === 'group' ? (
            <TabGroupBlock key={`group-${entry.group.id}`} group={entry.group} tabs={entry.tabs} />
          ) : (
            <TabRow
              key={entry.tab.id}
              tab={entry.tab}
              highlighted={entry.tab.active && entry.tab.windowId === windowId}
            />
          ),
        )}
      </ul>
    </section>
  );
}
