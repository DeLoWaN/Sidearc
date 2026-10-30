import { PinnedRow } from '../components/PinnedRow';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';

/** The Pinned Tabs, in the order of the state. Ticket #5 adds the Folders. */
export function PinnedSection() {
  const { windowId } = usePanel();
  const items = usePanelStore((store) => store.state.items);
  if (items.length === 0) return null;
  return (
    <section aria-label="Pinned Tabs">
      <ul>
        {items.map((item) => (
          <PinnedRow
            key={item.id}
            item={item}
            highlighted={Boolean(item.live?.active && item.live.windowId === windowId)}
          />
        ))}
      </ul>
    </section>
  );
}
