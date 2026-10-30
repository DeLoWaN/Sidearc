import { countBelow } from '../../shared/item-tree';
import { copyToClipboard } from '../clipboard';
import { itemMoveTargets } from '../move-targets';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';
import { MoveToSubMenu } from './MoveToSubMenu';
import { ContextMenu, MenuItem, MenuSeparator } from './menu';

/**
 * The right-click menu of an item: New folder for a Folder, rename, Reset and copy URL for a link,
 * Move to… and delete. With no item, it is the menu of the root of the Pinned Tabs: only New folder.
 */
export function ItemMenu() {
  const { send } = usePanel();
  const { menu, closeMenu, startRename, startCreateFolder, askDeleteConfirmation } = usePanelUi();
  const items = usePanelStore((store) => store.state.items);
  const item = items.find((i) => i.id === menu?.itemId);

  if (!menu || (menu.itemId !== null && !item)) return null;

  const newFolder = (
    <MenuItem
      onSelect={() => {
        // The new Folder needs an open parent to show its name field.
        if (item?.collapsed) send({ type: 'folder/toggle', itemId: item.id });
        startCreateFolder(item?.kind === 'folder' ? item.id : null);
      }}
    >
      New folder
    </MenuItem>
  );

  return (
    <ContextMenu
      label={`Actions for ${item?.title ?? 'Pinned Tabs'}`}
      x={menu.x}
      y={menu.y}
      returnFocusTo={menu.opener}
      onClose={closeMenu}
    >
      {(!item || item.kind === 'folder') && newFolder}
      {item && (
        <>
          <MenuItem onSelect={() => startRename(item.id)}>Rename</MenuItem>
          {item.kind !== 'folder' && (
            <>
              <MenuItem
                disabled={!item.live}
                onSelect={() => send({ type: 'item/reset', itemId: item.id })}
              >
                Reset
              </MenuItem>
              <MenuItem onSelect={() => copyToClipboard(item.url)}>Copy URL</MenuItem>
            </>
          )}
          <MoveToSubMenu targets={itemMoveTargets(items, item)} onChoose={send} />
          <MenuSeparator />
          <MenuItem
            danger
            onSelect={() =>
              // Deleting a Folder deletes its content too: the user must confirm that.
              countBelow(items, item.id) > 0
                ? askDeleteConfirmation(item.id)
                : send({ type: 'item/delete', itemId: item.id })
            }
          >
            Delete
          </MenuItem>
        </>
      )}
    </ContextMenu>
  );
}
