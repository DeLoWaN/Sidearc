import { type MouseEvent, type ReactNode, useState } from 'react';
import type { TabView } from '../../shared/types';
import { copyToClipboard } from '../clipboard';
import { tabMoveTargets } from '../move-targets';
import { usePanel } from '../panel-context';
import { claimContextMenu } from '../selection-actions';
import { usePanelStore } from '../store';
import { MoveToSubMenu } from './MoveToSubMenu';
import { ContextMenu, MenuItem, MenuSeparator } from './menu';
import { focusableUnder } from './use-item-context-menu';

/**
 * The right-click menu of an Unpinned Tab: Copy URL, Move to…, Remove from group (a site group member only) and Close tab.
 * The targets of Move to… are the Favorites, the Pinned Tabs, the Folders, the Tab groups and "Out of group".
 * Returns the handler for the right click of the tab row and the menu to render next to it.
 */
export function useTabGroupMenu(tab: TabView): {
  onContextMenu: (event: MouseEvent) => void;
  menu: ReactNode;
} {
  const { send } = usePanel();
  const items = usePanelStore((store) => store.state.items);
  const groups = usePanelStore((store) => store.state.tabGroups);
  const inSiteGroup = usePanelStore((store) =>
    store.state.siteGroups.some((group) => group.tabIds.includes(tab.id)),
  );
  const [open, setOpen] = useState<{ x: number; y: number; opener: HTMLElement | null }>();

  return {
    onContextMenu: (event) => {
      const opener = focusableUnder(event.target);
      if (claimContextMenu(event, { kind: 'tab', id: tab.id }, opener)) return;
      event.preventDefault();
      setOpen({ x: event.clientX, y: event.clientY, opener });
    },
    menu: open && (
      <ContextMenu
        label={`Actions for ${tab.title}`}
        x={open.x}
        y={open.y}
        returnFocusTo={open.opener}
        onClose={() => setOpen(undefined)}
      >
        <MenuItem onSelect={() => copyToClipboard(tab.url)}>Copy URL</MenuItem>
        <MoveToSubMenu targets={tabMoveTargets(items, groups, tab)} onChoose={send} />
        {inSiteGroup && (
          <MenuItem onSelect={() => send({ type: 'site-group/remove-tab', tabId: tab.id })}>
            Remove from group
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem danger onSelect={() => send({ type: 'tab/close', tabId: tab.id })}>
          Close tab
        </MenuItem>
      </ContextMenu>
    ),
  };
}
