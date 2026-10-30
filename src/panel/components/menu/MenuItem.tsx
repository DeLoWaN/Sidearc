import type { ReactNode } from 'react';
import { useMenuLevel, useMenuRoot } from './menu-context';

export const ENTRY_CLASS =
  'flex w-full items-center rounded-md px-2.5 py-1.5 text-left outline-none focus:bg-(--menu-active) aria-expanded:bg-(--menu-active) aria-disabled:opacity-40';

/**
 * One entry of a menu. A click closes the whole menu, then runs `onSelect`.
 * A disabled entry takes no focus from the pointer and runs nothing.
 */
export function MenuItem({
  children,
  onSelect,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const root = useMenuRoot();
  const level = useMenuLevel();
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      className={`${ENTRY_CLASS} ${danger ? 'text-(--danger)' : ''}`}
      onPointerMove={(event) => {
        level.setOpenSubmenu(null);
        if (disabled) level.focusPanel();
        else event.currentTarget.focus();
      }}
      onPointerLeave={level.focusPanel}
      onClick={() => {
        if (disabled) return;
        root.close();
        onSelect();
      }}
    >
      {children}
    </button>
  );
}
