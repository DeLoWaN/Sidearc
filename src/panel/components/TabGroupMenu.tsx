import { type MouseEvent, type ReactNode, useState } from 'react';
import type { TabView } from '../../shared/types';
import { tabMoveTargets } from '../move-targets';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { MoveToMenu } from './MoveToMenu';

/**
 * The right-click "Move to…" menu of an Unpinned Tab: its targets are the Tab groups and "Out of group".
 * Returns the handler for the right click of the tab row and the menu to render next to it.
 * The handler does nothing when the tab has no target, so the browser menu opens instead.
 */
export function useTabGroupMenu(tab: TabView): {
  onContextMenu: (event: MouseEvent) => void;
  menu: ReactNode;
} {
  const { send } = usePanel();
  const groups = usePanelStore((store) => store.state.tabGroups);
  const [position, setPosition] = useState<{ x: number; y: number }>();
  const targets = tabMoveTargets(groups, tab);

  return {
    onContextMenu: (event) => {
      if (targets.length === 0) return;
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
