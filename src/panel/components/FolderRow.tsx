import { useRef } from 'react';
import type { ItemView } from '../../shared/types';
import type { TreeNode } from '../build-tree';
import { DropIndicator } from '../dnd/DropIndicator';
import { folderRowTarget } from '../dnd/locators';
import { useDnd } from '../dnd/use-dnd';
import { usePanel } from '../panel-context';
import { selectOnClick, useRowSelection } from '../selection-actions';
import { usePanelUi } from '../ui-store';
import { DeleteCross } from './DeleteCross';
import { ItemList } from './ItemTree';
import { RenameField } from './RenameField';
import { useDeleteItem } from './use-delete-item';
import { useItemContextMenu } from './use-item-context-menu';
import { useMiddleClickClose } from './use-middle-click-close';

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
  const { renamingId } = usePanelUi();
  const onContextMenu = useItemContextMenu(item.id);
  const deleteItem = useDeleteItem();
  const renaming = renamingId === item.id;
  const middleClick = useMiddleClickClose(renaming ? undefined : () => deleteItem(item.id));
  const selectable = { kind: 'item', id: item.id } as const;
  const { selected, marking } = useRowSelection(selectable);
  const header = useRef<HTMLDivElement>(null);
  const { placement, dragging } = useDnd(header, {
    source: { type: 'item', itemId: item.id },
    row: selectable,
    canDrag: !renaming,
    locate: folderRowTarget(item),
  });
  return (
    <li data-drop={placement ?? undefined}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the context menu key on the row button reaches this handler too; the middle click is a pointer shortcut. */}
      <div
        ref={header}
        data-dragging={dragging || undefined}
        data-selected={selected || undefined}
        onContextMenu={onContextMenu}
        {...middleClick}
        className="group relative flex h-(--row-height) items-center rounded-[10px] hover:bg-(--row-hover) data-dragging:opacity-40"
      >
        {placement && <DropIndicator placement={placement} />}
        {renaming ? (
          <div className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-2.5">
            {folderIcon}
            <RenameField item={item} />
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={!item.collapsed}
            aria-pressed={marking ? selected : undefined}
            onClick={(event) => {
              if (!selectOnClick(event, selectable))
                send({ type: 'folder/toggle', itemId: item.id });
            }}
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
        {!renaming && <DeleteCross title={item.title} onDelete={() => deleteItem(item.id)} />}
      </div>
      {!item.collapsed && (
        <div className="ml-3.5 border-l border-(--row-hover) pl-1">
          <ItemList nodes={nodes} parentId={item.id} label={`${item.title} content`} />
        </div>
      )}
    </li>
  );
}
