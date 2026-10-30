import { type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import type { TabView } from '../../shared/types';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';

/**
 * A small right-click menu that moves an Unpinned Tab into a Tab group, or out of its group.
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

  const current = groups.find((group) => group.tabIds.includes(tab.id));
  const targets = groups.filter((group) => group !== current);
  const hasMenu = current !== undefined || targets.length > 0;

  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(undefined);
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [position]);

  const choose = (command: Parameters<typeof send>[0]) => {
    setPosition(undefined);
    send(command);
  };

  const item = 'block w-full rounded-md px-3 py-1.5 text-left hover:bg-(--row-hover)';
  return {
    onContextMenu: (event) => {
      if (!hasMenu) return;
      event.preventDefault();
      setPosition({ x: event.clientX, y: event.clientY });
    },
    menu: position && (
      <div
        role="menu"
        aria-label="Move to…"
        style={{ left: position.x, top: position.y }}
        // The click that picks an item must not reach the listener that closes the menu first.
        onPointerDown={(event) => event.stopPropagation()}
        className="fixed z-10 min-w-40 rounded-lg bg-(--row-active) p-1 shadow-lg"
      >
        {targets.map((group) => (
          <button
            key={group.id}
            type="button"
            role="menuitem"
            className={item}
            onClick={() => choose({ type: 'group/add-tab', tabId: tab.id, groupId: group.id })}
          >
            {group.title || 'Untitled group'}
          </button>
        ))}
        {current && (
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => choose({ type: 'group/remove-tab', tabId: tab.id })}
          >
            Out of group
          </button>
        )}
      </div>
    ),
  };
}
