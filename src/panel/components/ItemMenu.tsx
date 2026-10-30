import { useEffect, useRef } from 'react';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';

const entry =
  'block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-(--row-hover) disabled:opacity-40';

/** The right-click menu of an item: rename, Reset, copy URL and delete. */
export function ItemMenu() {
  const { send } = usePanel();
  const { menu, closeMenu, startRename } = usePanelUi();
  const item = usePanelStore((store) => store.state.items.find((i) => i.id === menu?.itemId));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && closeMenu();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menu, closeMenu]);

  if (!menu || !item) return null;

  const run = (action: () => void) => () => {
    closeMenu();
    action();
  };

  return (
    <div
      ref={root}
      role="menu"
      aria-label={`Actions for ${item.title}`}
      style={{ left: menu.x, top: menu.y }}
      className="fixed z-10 min-w-36 rounded-xl bg-(--menu-bg) p-1 shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        className={entry}
        onClick={run(() => startRename(item.id))}
      >
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!item.live}
        className={entry}
        onClick={run(() => send({ type: 'item/reset', itemId: item.id }))}
      >
        Reset
      </button>
      <button
        type="button"
        role="menuitem"
        className={entry}
        onClick={run(() => {
          navigator.clipboard.writeText(item.url).catch(console.error);
        })}
      >
        Copy URL
      </button>
      <button
        type="button"
        role="menuitem"
        className={entry}
        onClick={run(() => send({ type: 'item/delete', itemId: item.id }))}
      >
        Delete
      </button>
    </div>
  );
}
