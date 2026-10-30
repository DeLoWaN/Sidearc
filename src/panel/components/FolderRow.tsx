import type { ItemView } from '../../shared/types';
import type { TreeNode } from '../build-tree';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { ItemList } from './ItemTree';
import { RenameField } from './RenameField';

const folderIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="size-4 shrink-0 text-(--text-muted)"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinejoin="round"
  >
    <path d="M1.5 4.5a1 1 0 0 1 1-1h3.2l1.3 1.5h6.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
  </svg>
);

/** A Folder: a row that collapses or expands it, and its content. */
export function FolderRow({ item, nodes }: { item: ItemView; nodes: TreeNode[] }) {
  const { send } = usePanel();
  const { openMenu, renamingId } = usePanelUi();
  return (
    <li>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the context menu key on the row button reaches this handler too. */}
      <div
        onContextMenu={(event) => {
          event.preventDefault();
          openMenu(item.id, event.clientX, event.clientY);
        }}
        className="flex h-(--row-height) items-center rounded-[10px] hover:bg-(--row-hover)"
      >
        {renamingId === item.id ? (
          <div className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-2.5">
            {folderIcon}
            <RenameField item={item} />
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={!item.collapsed}
            onClick={() => send({ type: 'folder/toggle', itemId: item.id })}
            className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 text-left"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 8 8"
              className={`size-2 shrink-0 text-(--text-muted) ${item.collapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 1l3 3-3 3" />
            </svg>
            {folderIcon}
            <span className="truncate font-medium">{item.title}</span>
          </button>
        )}
      </div>
      {!item.collapsed && (
        <div className="ml-3.5 border-l border-(--row-hover) pl-1">
          <ItemList nodes={nodes} parentId={item.id} label={`${item.title} content`} />
        </div>
      )}
    </li>
  );
}
