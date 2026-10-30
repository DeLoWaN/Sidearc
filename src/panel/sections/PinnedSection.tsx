import { ItemList } from '../components/ItemTree';
import { buildTree } from '../item-tree';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';

/** The Pinned Tabs as a tree of Folders. */
export function PinnedSection() {
  const items = usePanelStore((store) => store.state.items);
  const { openMenu, startCreateFolder } = usePanelUi();
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
      <div className="flex h-7 items-center justify-between px-2.5 text-[11px] font-semibold text-(--text-muted) uppercase">
        <span aria-hidden="true">Pinned</span>
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
