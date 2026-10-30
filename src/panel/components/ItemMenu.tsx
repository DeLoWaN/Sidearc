import { useEffect, useRef } from 'react';
import { countBelow } from '../item-tree';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';

const entry =
  'block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-(--row-hover) disabled:opacity-40';

/**
 * The right-click menu of an item: rename, Reset, copy URL and delete, and New folder for a Folder.
 * With no item, it is the menu of the root of the Pinned Tabs: only New folder.
 */
export function ItemMenu() {
  const { send } = usePanel();
  const { menu, closeMenu, startRename, startCreateFolder, askDeleteConfirmation } = usePanelUi();
  const items = usePanelStore((store) => store.state.items);
  const item = items.find((i) => i.id === menu?.itemId);
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

  if (!menu || (menu.itemId !== null && !item)) return null;

  const run = (action: () => void) => () => {
    closeMenu();
    action();
  };

  const parentId = item?.kind === 'folder' ? item.id : null;
  const newFolder = (
    <button
      type="button"
      role="menuitem"
      className={entry}
      onClick={run(() => {
        // The new Folder needs an open parent to show its name field.
        if (item?.collapsed) send({ type: 'folder/toggle', itemId: item.id });
        startCreateFolder(parentId);
      })}
    >
      New folder
    </button>
  );

  return (
    <div
      ref={root}
      role="menu"
      aria-label={`Actions for ${item?.title ?? 'Pinned Tabs'}`}
      style={{ left: menu.x, top: menu.y }}
      className="fixed z-10 min-w-36 rounded-xl bg-(--menu-bg) p-1 shadow-lg"
    >
      {(!item || item.kind === 'folder') && newFolder}
      {item && (
        <>
          <button
            type="button"
            role="menuitem"
            className={entry}
            onClick={run(() => startRename(item.id))}
          >
            Rename
          </button>
          {item.kind === 'pinned' && (
            <>
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
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className={entry}
            onClick={run(() =>
              // Deleting a Folder deletes its content too: the user must confirm that.
              countBelow(items, item.id) > 0
                ? askDeleteConfirmation(item.id)
                : send({ type: 'item/delete', itemId: item.id }),
            )}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
