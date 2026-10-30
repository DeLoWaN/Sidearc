import { useRef } from 'react';
import type { TabView } from '../../shared/types';
import { DropIndicator } from '../dnd/DropIndicator';
import { tabRowTarget } from '../dnd/locators';
import { useDnd } from '../dnd/use-dnd';
import { usePanel } from '../panel-context';
import { CloseIcon } from './CloseIcon';
import { SiteIcon } from './SiteIcon';
import { useTabGroupMenu } from './TabGroupMenu';
import { useMiddleClickClose } from './use-middle-click-close';

/** One open tab. A click shows the tab, the close button closes it. */
export function TabRow({ tab, highlighted }: { tab: TabView; highlighted: boolean }) {
  const { send } = usePanel();
  const { onContextMenu, menu } = useTabGroupMenu(tab);
  const middleClick = useMiddleClickClose({ type: 'tab/close', tabId: tab.id });
  const row = useRef<HTMLLIElement>(null);
  const { placement, dragging } = useDnd(row, {
    source: { type: 'tab', tabId: tab.id },
    locate: tabRowTarget(tab.id),
  });
  return (
    <li
      ref={row}
      data-drop={placement ?? undefined}
      data-dragging={dragging || undefined}
      onContextMenu={onContextMenu}
      {...middleClick}
      data-highlighted={highlighted || undefined}
      className="group relative flex h-(--row-height) items-center rounded-[10px] hover:bg-(--row-hover) data-dragging:opacity-40 data-highlighted:bg-(--row-active) data-highlighted:shadow-sm"
    >
      {placement && <DropIndicator placement={placement} />}
      <button
        type="button"
        aria-current={highlighted || undefined}
        onClick={() => send({ type: 'tab/activate', tabId: tab.id })}
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 text-left"
      >
        <span className="relative shrink-0">
          <SiteIcon iconUrl={tab.iconUrl} title={tab.title} />
          {tab.unvisited && (
            <span
              role="img"
              aria-label="Not visited yet"
              title="Not visited yet"
              className="absolute -top-1 -left-1 size-2 rounded-full bg-(--unvisited)"
            />
          )}
        </span>
        <span className={tab.unvisited ? 'truncate font-semibold' : 'truncate'}>{tab.title}</span>
      </button>
      <button
        type="button"
        aria-label={`Close ${tab.title}`}
        onClick={() => send({ type: 'tab/close', tabId: tab.id })}
        className="mr-2 grid size-5 shrink-0 place-items-center rounded-md text-(--text-muted) opacity-0 hover:bg-(--row-hover) focus-visible:opacity-100 group-hover:opacity-100"
      >
        <CloseIcon />
      </button>
      {menu}
    </li>
  );
}
