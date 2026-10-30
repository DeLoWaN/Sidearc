import { buildTree } from '../build-tree';
import { ItemList } from '../components/ItemTree';
import { PinnedRow } from '../components/PinnedRow';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';
import { useSearchResults } from '../use-search-results';

const heading = (
  <span aria-hidden="true" className="text-[11px] font-semibold text-(--text-muted) uppercase">
    Pinned
  </span>
);

/** The Pinned Tabs as a tree of Folders. A search shows the matching Pinned Tabs as a flat list. */
export function PinnedSection() {
  const { windowId } = usePanel();
  const items = usePanelStore((store) => store.state.items);
  const { openMenu, startCreateFolder } = usePanelUi();
  const results = useSearchResults();

  if (results) {
    if (results.pinned.length === 0) return null;
    return (
      <section aria-label="Pinned Tabs">
        <div className="flex h-7 items-center px-2.5">{heading}</div>
        <ul aria-label="Pinned Tabs list">
          {results.pinned.map(({ item, path }) => (
            <PinnedRow
              key={item.id}
              item={item}
              path={path}
              highlighted={Boolean(item.live?.active && item.live.windowId === windowId)}
            />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      aria-label="Pinned Tabs"
      onContextMenu={(event) => {
        // A row has its own menu and has already handled the click.
        if (event.defaultPrevented) return;
        event.preventDefault();
        openMenu(null, event.clientX, event.clientY);
      }}
    >
      <div className="flex h-7 items-center justify-between px-2.5">
        {heading}
        <button
          type="button"
          aria-label="New folder"
          onClick={() => startCreateFolder(null)}
          className="size-5 rounded-md hover:bg-(--row-hover)"
        >
          +
        </button>
      </div>
      <ItemList nodes={buildTree(items)} parentId={null} label="Pinned Tabs list" />
    </section>
  );
}
