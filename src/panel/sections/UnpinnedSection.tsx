import { useRef } from 'react';
import { ClearDivider } from '../components/ClearDivider';
import { SiteGroupBlock } from '../components/SiteGroupBlock';
import { TabGroupBlock } from '../components/TabGroupBlock';
import { TabRow } from '../components/TabRow';
import { DropIndicator } from '../dnd/DropIndicator';
import { unpinnedSectionTarget } from '../dnd/locators';
import { useDnd } from '../dnd/use-dnd';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { arrangeUnpinned } from '../tab-groups';
import { useRevealNewTabs } from '../use-reveal-new-tabs';
import { useSearchResults } from '../use-search-results';

/** The Unpinned Tabs of all windows, in tab strip order. The active tab of this window is highlighted. */
export function UnpinnedSection() {
  const { windowId } = usePanel();
  const allTabs = usePanelStore((store) => store.state.unpinnedTabs);
  const results = useSearchResults();
  const tabs = results?.tabs ?? allTabs;
  const groups = usePanelStore((store) => store.state.tabGroups);
  const siteGroups = usePanelStore((store) => store.state.siteGroups);
  const section = useRef<HTMLElement>(null);
  const { placement } = useDnd(section, { locate: unpinnedSectionTarget });
  useRevealNewTabs(section);
  // Clear closes every Unpinned Tab, also the ones that a search hides.
  if (results && tabs.length === 0) return null;
  return (
    <section
      ref={section}
      aria-label="Unpinned Tabs"
      data-drop={placement ?? undefined}
      className="relative"
    >
      {placement && <DropIndicator placement={placement} />}
      {!results && <ClearDivider disabled={tabs.length === 0} />}
      <ul>
        {arrangeUnpinned(tabs, groups, siteGroups).map((entry) => {
          if (entry.kind === 'group') {
            return (
              <TabGroupBlock
                key={`group-${entry.group.id}`}
                group={entry.group}
                tabs={entry.tabs}
              />
            );
          }
          if (entry.kind === 'site-group') {
            return (
              <SiteGroupBlock
                key={`site-group-${entry.group.id}`}
                group={entry.group}
                tabs={entry.tabs}
              />
            );
          }
          return (
            <TabRow
              key={entry.tab.id}
              tab={entry.tab}
              highlighted={entry.tab.active && entry.tab.windowId === windowId}
            />
          );
        })}
      </ul>
    </section>
  );
}
