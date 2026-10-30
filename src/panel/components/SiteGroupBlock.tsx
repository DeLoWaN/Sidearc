import { type MouseEvent, useState } from 'react';
import type { SiteGroupView, TabView } from '../../shared/types';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { ContextMenu, MenuItem } from './menu';
import { SiteIcon } from './SiteIcon';
import { TabRow } from './TabRow';
import { focusableUnder } from './use-item-context-menu';

/** A site group: a header with the site and the member count, and the member tabs. Only the panel shows it. */
export function SiteGroupBlock({ group, tabs }: { group: SiteGroupView; tabs: TabView[] }) {
  const { windowId, send } = usePanel();
  const searching = usePanelUi((ui) => ui.searching);
  const [menu, setMenu] = useState<{ x: number; y: number; opener: HTMLElement | null }>();
  // A search shows the matching members of a collapsed group and leaves the group state alone.
  const collapsed = group.collapsed && !searching;
  const hasUnvisited = collapsed && tabs.some((tab) => tab.unvisited);

  const openMenu = (event: MouseEvent) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, opener: focusableUnder(event.target) });
  };

  return (
    <li role="none">
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset is a form control, not a block. */}
      <div
        role="group"
        aria-label={group.host}
        data-site-group=""
        className="my-1 ml-3 border-l border-(--text-muted)/40 pl-1"
      >
        <button
          type="button"
          aria-label={group.host}
          aria-expanded={!collapsed}
          disabled={searching}
          onClick={() => send({ type: 'site-group/toggle', groupId: group.id })}
          onContextMenu={openMenu}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] font-semibold text-(--text-muted) hover:bg-(--row-hover)"
        >
          <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
          <span className="relative shrink-0">
            <SiteIcon iconUrl={tabs[0]?.iconUrl ?? ''} title={group.host} />
            {hasUnvisited && (
              <span
                role="img"
                aria-label="Not visited yet"
                title="Not visited yet"
                className="absolute -top-1 -left-1 size-2 rounded-full bg-(--unvisited)"
              />
            )}
          </span>
          <span className="truncate">{group.host}</span>
          <span className="font-normal">· {tabs.length}</span>
        </button>
        {!collapsed && (
          <ul>
            {tabs.map((tab) => (
              <TabRow
                key={tab.id}
                tab={tab}
                highlighted={tab.active && tab.windowId === windowId}
              />
            ))}
          </ul>
        )}
      </div>
      {menu && (
        <ContextMenu
          label={`Actions for ${group.host}`}
          x={menu.x}
          y={menu.y}
          returnFocusTo={menu.opener}
          onClose={() => setMenu(undefined)}
        >
          <MenuItem onSelect={() => send({ type: 'site-group/ungroup', groupId: group.id })}>
            Ungroup
          </MenuItem>
        </ContextMenu>
      )}
    </li>
  );
}
