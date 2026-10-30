import { useRef } from 'react';
import type { ItemView } from '../../shared/types';
import { DropIndicator } from '../dnd/DropIndicator';
import { pinnedRowTarget } from '../dnd/locators';
import { useDnd } from '../dnd/use-dnd';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { RenameField } from './RenameField';
import { SiteIcon } from './SiteIcon';
import { useItemContextMenu } from './use-item-context-menu';

const iconButton =
  'mr-1 grid size-5 shrink-0 place-items-center rounded-md text-(--text-muted) hover:bg-(--row-hover) focus-visible:opacity-100';

/**
 * One Pinned Tab. At rest the row is faded. With an open live tab it shows a close button.
 * When the live tab left the saved URL, the row adds "/", the current title and Reset.
 */
export function PinnedRow({
  item,
  highlighted,
  path,
}: {
  item: ItemView;
  highlighted: boolean;
  /** The Folders above the item, outermost first. Search results show it: the Folders are not on screen. */
  path?: string[];
}) {
  const { send } = usePanel();
  const { renamingId } = usePanelUi();
  const onContextMenu = useItemContextMenu(item.id);
  const { live } = item;
  const row = useRef<HTMLLIElement>(null);
  const { placement, dragging } = useDnd(row, {
    source: { type: 'item', itemId: item.id },
    canDrag: renamingId !== item.id,
    locate: pinnedRowTarget(item),
  });

  return (
    <li
      ref={row}
      data-drop={placement ?? undefined}
      data-dragging={dragging || undefined}
      data-live={live ? true : undefined}
      data-highlighted={highlighted || undefined}
      onContextMenu={onContextMenu}
      className="group relative flex h-(--row-height) items-center rounded-[10px] hover:bg-(--row-hover) data-dragging:opacity-40 data-highlighted:bg-(--row-active) data-highlighted:shadow-sm"
    >
      {placement && <DropIndicator placement={placement} />}
      {renamingId === item.id ? (
        <div className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-2.5">
          <SiteIcon iconUrl={item.iconUrl} title={item.title} />
          <RenameField item={item} />
        </div>
      ) : (
        <button
          type="button"
          aria-current={highlighted || undefined}
          onClick={() => send({ type: 'item/open', itemId: item.id })}
          className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 text-left"
        >
          <SiteIcon iconUrl={item.iconUrl} title={item.title} />
          <span className={`truncate ${live ? '' : 'opacity-55'}`}>{item.title}</span>
          {path && path.length > 0 && (
            <span className="ml-auto max-w-[50%] shrink-0 truncate text-xs text-(--text-muted)">
              {path.join(' / ')}
            </span>
          )}
          {live?.away && (
            <>
              <span className="text-(--text-muted)">/</span>
              <span className="truncate text-(--text-muted)">{live.title}</span>
            </>
          )}
        </button>
      )}
      {live?.away && (
        <button
          type="button"
          aria-label={`Reset ${item.title}`}
          onClick={() => send({ type: 'item/reset', itemId: item.id })}
          className={iconButton}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 6a4 4 0 1 0 1.2-2.8M2 1.5v2.2h2.2" />
          </svg>
        </button>
      )}
      {live && (
        <button
          type="button"
          aria-label={`Close ${item.title}`}
          onClick={() => send({ type: 'tab/close', tabId: live.tabId })}
          className={`${iconButton} mr-2 opacity-0 group-hover:opacity-100`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2.5 6h7" />
          </svg>
        </button>
      )}
    </li>
  );
}
