import { useRef } from 'react';
import type { ItemView } from '../../shared/types';
import { DropIndicator } from '../dnd/DropIndicator';
import { favoriteTileTarget } from '../dnd/locators';
import { useDnd } from '../dnd/use-dnd';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { RenameField } from './RenameField';
import { SiteIcon } from './SiteIcon';

/**
 * One Favorite: a large icon. The title is the tooltip.
 * A dot marks an open live tab, and a close button shows on hover.
 * While the user renames it, the tile takes the full width for the name field.
 */
export function FavoriteTile({ item, highlighted }: { item: ItemView; highlighted: boolean }) {
  const { send } = usePanel();
  const { openMenu, renamingId } = usePanelUi();
  const { live } = item;
  const renaming = renamingId === item.id;
  const tile = useRef<HTMLLIElement>(null);
  const { placement, dragging } = useDnd(tile, {
    source: { type: 'item', itemId: item.id },
    canDrag: !renaming,
    locate: favoriteTileTarget(item),
  });

  return (
    <li
      ref={tile}
      data-drop={placement ?? undefined}
      data-dragging={dragging || undefined}
      data-live={live ? true : undefined}
      data-highlighted={highlighted || undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu(item.id, event.clientX, event.clientY);
      }}
      className={`group relative grid h-(--favorite-size) place-items-center rounded-xl bg-(--favorite-bg) hover:bg-(--row-active) data-dragging:opacity-40 data-highlighted:bg-(--row-active) data-highlighted:shadow-sm ${renaming ? 'col-span-full' : ''}`}
    >
      {placement && <DropIndicator placement={placement} />}
      {renaming ? (
        <div className="flex h-full w-full min-w-0 items-center gap-2.5 px-2.5">
          <SiteIcon iconUrl={item.iconUrl} title={item.title} large />
          <RenameField item={item} />
        </div>
      ) : (
        <button
          type="button"
          aria-label={item.title}
          aria-current={highlighted || undefined}
          title={item.title}
          onClick={() => send({ type: 'item/open', itemId: item.id })}
          className="grid size-full place-items-center rounded-xl"
        >
          <SiteIcon iconUrl={item.iconUrl} title={item.title} large />
        </button>
      )}
      {live && !renaming && (
        <>
          <span
            role="img"
            aria-label="Open"
            className="pointer-events-none absolute bottom-1.5 size-1 rounded-full bg-(--text-muted)"
          />
          <button
            type="button"
            aria-label={`Close ${item.title}`}
            onClick={() => send({ type: 'tab/close', tabId: live.tabId })}
            className="absolute top-1 right-1 grid size-4 place-items-center rounded-md text-(--text-muted) opacity-0 hover:bg-(--row-hover) focus-visible:opacity-100 group-hover:opacity-100"
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
        </>
      )}
    </li>
  );
}
