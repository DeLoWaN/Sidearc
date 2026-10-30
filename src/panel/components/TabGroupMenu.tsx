import { type MouseEvent, type ReactNode, useState } from 'react';
import type { TabView } from '../../shared/types';
import { tabMoveTargets } from '../move-targets';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { MoveToMenu } from './MoveToMenu';

/**
 * The right-click "Move to…" menu of an Unpinned Tab: its targets are the Favorites, the Pinned Tabs,
 * the Folders, the Tab groups and "Out of group".
 * Returns the handler for the right click of the tab row and the menu to render next to it.
 */
export function useTabGroupMenu(tab: TabView): {
  onContextMenu: (event: MouseEvent) => void;
  menu: ReactNode;
} {
  const { send } = usePanel();
  const items = usePanelStore((store) => store.state.items);
  const groups = usePanelStore((store) => store.state.tabGroups);
  const [position, setPosition] = useState<{ x: number; y: number }>();
  const targets = tabMoveTargets(items, groups, tab);

  return {
    onContextMenu: (event) => {
      event.preventDefault();
      setPosition({ x: event.clientX, y: event.clientY });
    },
    menu: position && (
      <MoveToMenu
        x={position.x}
        y={position.y}
        targets={targets}
        onChoose={send}
        onClose={() => setPosition(undefined)}
      />
    ),
  };
}
