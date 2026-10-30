import { itemMoveTargets } from '../move-targets';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { usePanelUi } from '../ui-store';
import { MoveToMenu } from './MoveToMenu';

/** The "Move to…" menu of a Pinned Tab or a Folder. */
export function ItemMoveMenu() {
  const { send } = usePanel();
  const { moveMenu, closeMoveMenu } = usePanelUi();
  const items = usePanelStore((store) => store.state.items);
  const item = items.find((candidate) => candidate.id === moveMenu?.itemId);
  if (!moveMenu || !item) return null;
  return (
    <MoveToMenu
      x={moveMenu.x}
      y={moveMenu.y}
      targets={itemMoveTargets(items, item)}
      onChoose={send}
      onClose={closeMoveMenu}
    />
  );
}
