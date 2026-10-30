import { plural } from '../../shared/plural';
import { selectionMoveTargets } from '../move-targets';
import { usePanel } from '../panel-context';
import { chosenCount, chosenRows } from '../selection';
import { closeSelection } from '../selection-actions';
import { usePanelSelection } from '../selection-store';
import { usePanelStore } from '../store';
import { MoveToSubMenu } from './MoveToSubMenu';
import { ContextMenu, MenuItem } from './menu';

/** The right-click menu of a selected row: it acts on the whole selection. */
export function SelectionMenu() {
  const { send } = usePanel();
  const state = usePanelStore((store) => store.state);
  const { menu, selected, closeMenu } = usePanelSelection();
  if (!menu) return null;
  const rows = chosenRows(state, selected);
  const count = chosenCount(rows);
  if (count === 0) return null;

  return (
    <ContextMenu
      label={`Actions for ${plural(count, 'selected item')}`}
      x={menu.x}
      y={menu.y}
      returnFocusTo={menu.opener}
      onClose={closeMenu}
    >
      <MoveToSubMenu targets={selectionMoveTargets(state, rows)} onChoose={send} />
      <MenuItem danger onSelect={() => closeSelection(send)}>
        Close {plural(count, 'item')}
      </MenuItem>
    </ContextMenu>
  );
}
