import { TabRow } from '../components/TabRow';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';

/** The Unpinned Tabs of all windows, in tab strip order. The active tab of this window is highlighted. */
export function UnpinnedSection() {
  const { windowId } = usePanel();
  const tabs = usePanelStore((store) => store.state.unpinnedTabs);
  return (
    <section aria-label="Unpinned Tabs">
      <ul>
        {tabs.map((tab) => (
          <TabRow key={tab.id} tab={tab} highlighted={tab.active && tab.windowId === windowId} />
        ))}
      </ul>
    </section>
  );
}
