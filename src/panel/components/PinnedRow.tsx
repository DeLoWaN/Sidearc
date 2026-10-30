import { useRef } from 'react';
import type { ItemView } from '../../shared/types';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { SiteIcon } from './SiteIcon';

const iconButton =
  'mr-1 grid size-5 shrink-0 place-items-center rounded-md text-(--text-muted) hover:bg-(--row-hover) focus-visible:opacity-100';

/** The field that replaces the title while the user renames the item. */
function RenameField({ item }: { item: ItemView }) {
  const { send } = usePanel();
  const stopRename = usePanelUi((ui) => ui.stopRename);
  const finished = useRef(false);

  // Enter and the loss of focus both end the edit: the first one wins.
  const finish = (value: string, save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const title = value.trim();
    if (save && title && title !== item.title) {
      send({ type: 'item/rename', itemId: item.id, title });
    }
    stopRename();
  };

  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: the user just chose Rename, the field must take the keys.
      autoFocus
      aria-label={`Name of ${item.title}`}
      defaultValue={item.title}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => finish(event.currentTarget.value, true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') finish(event.currentTarget.value, true);
        if (event.key === 'Escape') finish(event.currentTarget.value, false);
      }}
      className="min-w-0 flex-1 rounded-md bg-(--row-active) px-1.5 py-0.5 outline-none"
    />
  );
}

/**
 * One Pinned Tab. At rest the row is faded. With an open live tab it shows a close button.
 * When the live tab left the saved URL, the row adds "/", the current title and Reset.
 */
export function PinnedRow({ item, highlighted }: { item: ItemView; highlighted: boolean }) {
  const { send } = usePanel();
  const { openMenu, renamingId } = usePanelUi();
  const { live } = item;

  return (
    <li
      data-live={live ? true : undefined}
      data-highlighted={highlighted || undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu(item.id, event.clientX, event.clientY);
      }}
      className="group flex h-(--row-height) items-center rounded-[10px] hover:bg-(--row-hover) data-highlighted:bg-(--row-active) data-highlighted:shadow-sm"
    >
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
          {live?.away && (
            <>
              <span aria-hidden="true" className="text-(--text-muted)">
                /
              </span>
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
