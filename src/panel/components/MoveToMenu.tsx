import { useEffect, useRef } from 'react';
import type { CommandBody } from '../connection';
import { moveFocusWithKeys, useFocusFirstEntry } from './menu-keys';

/** One place that "Move to…" can send an item or a tab to. */
export interface MoveTarget {
  key: string;
  label: string;
  /** How deep the target sits in the tree. It indents the label. */
  depth?: number;
  /** The command that does the move. */
  command: CommandBody;
}

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);

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
