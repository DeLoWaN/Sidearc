import { useRef } from 'react';
import { useDismiss } from '../../ui/use-dismiss';
import type { CommandBody } from '../connection';
import type { MoveTarget } from '../move-target';
import { moveFocusWithKeys, useFocusFirstEntry } from './menu-keys';

/**
 * The "Move to…" menu: a list of targets at a place on screen.
 * The menu holds no rule about what can move where: the caller gives the targets.
 * A choice sends the command of the target, then closes the menu, like Escape and a click outside.
 */
export function MoveToMenu({
  x,
  y,
  targets,
  onChoose,
  onClose,
}: {
  x: number;
  y: number;
  targets: MoveTarget[];
  onChoose: (command: CommandBody) => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useFocusFirstEntry(root, true);

  useDismiss(root, onClose);

  return (
    <div
      ref={root}
      role="menu"
      aria-label="Move to…"
      tabIndex={-1}
      onKeyDown={moveFocusWithKeys}
      style={{ left: x, top: y }}
      className="fixed z-10 min-w-40 rounded-lg bg-(--menu-bg) p-1 shadow-lg"
    >
      {targets.map(({ key, label, depth = 0, command }) => (
        <button
          key={key}
          type="button"
          role="menuitem"
          style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
          className="block w-full rounded-md py-1.5 pr-3 text-left hover:bg-(--row-hover) focus-visible:bg-(--row-hover)"
          onClick={() => {
            onClose();
            onChoose(command);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
