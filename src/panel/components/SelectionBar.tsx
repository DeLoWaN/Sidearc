import { useMemo, useState } from 'react';
import { selectionMoveTargets } from '../move-targets';
import { usePanel } from '../panel-context';
import { chosenCount, chosenRows } from '../selection';
import { closeSelection } from '../selection-actions';
import { usePanelSelection } from '../selection-store';
import { usePanelStore } from '../store';
import { ContextMenu, MenuItem } from './menu';

const button = 'h-7 shrink-0 rounded-md px-2 hover:bg-(--row-hover)';

/**
 * The bar above the footer while rows are selected: how many, and the buttons Close, Move to… and Clear.
 * It shows nothing without a selection.
 */
export function SelectionBar() {
  const { send } = usePanel();
  const state = usePanelStore((store) => store.state);
  const selected = usePanelSelection((selection) => selection.selected);
  const clear = usePanelSelection((selection) => selection.clear);
  const [moveMenu, setMoveMenu] = useState<{ x: number; y: number; opener: HTMLElement }>();
  const rows = useMemo(() => chosenRows(state, selected), [state, selected]);
  const count = chosenCount(rows);
  if (count === 0) return null;
  const targets = selectionMoveTargets(state, rows);

  return (
    <div className="mx-2.5 mb-2 flex shrink-0 items-center gap-1 rounded-xl bg-(--menu-bg) px-2 py-1 shadow-lg">
      <span role="status" className="min-w-0 flex-1 truncate">
        {count} selected
      </span>
      <button type="button" onClick={() => closeSelection(send)} className={button}>
        Close
      </button>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={moveMenu !== undefined}
        disabled={targets.length === 0}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          setMoveMenu({ x: box.left, y: box.top, opener: event.currentTarget });
        }}
        className={`${button} disabled:opacity-40 disabled:hover:bg-transparent`}
      >
        Move to…
      </button>
      <button type="button" onClick={clear} className={button}>
        Clear
      </button>
      {moveMenu && (
        <ContextMenu
          label="Move to"
          x={moveMenu.x}
          y={moveMenu.y}
          returnFocusTo={moveMenu.opener}
          onClose={() => setMoveMenu(undefined)}
        >
          {targets.map(({ key, label, depth, command }) => (
            <MenuItem key={key} depth={depth} onSelect={() => send(command)}>
              {label}
            </MenuItem>
          ))}
        </ContextMenu>
      )}
    </div>
  );
}
