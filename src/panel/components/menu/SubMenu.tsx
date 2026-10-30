import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ENTRY_CLASS } from './MenuItem';
import { MenuPanel } from './MenuPanel';
import { useMenuLevel } from './menu-context';
import type { Box } from './place-menu';

/** How long the pointer rests on the entry before the submenu opens. */
const HOVER_DELAY_MS = 150;
/** How far a submenu overlaps its entry, so that the pointer has no gap to cross. */
const OVERLAP = 4;

/**
 * An entry that opens a submenu next to it: on a click, on ArrowRight, Enter or Space,
 * and when the pointer rests on it. The submenu holds MenuItem entries.
 */
export function SubMenu({
  label,
  disabled = false,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const level = useMenuLevel();
  const trigger = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [anchor, setAnchor] = useState<Box>();
  const [focusFirst, setFocusFirst] = useState(false);
  const open = level.openSubmenu === id && anchor !== undefined;

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  function show(withFocus: boolean) {
    if (!trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    setAnchor({
      left: rect.left + OVERLAP,
      right: rect.right - OVERLAP,
      top: rect.top - OVERLAP,
      bottom: rect.bottom + OVERLAP,
    });
    setFocusFirst(withFocus);
    level.setOpenSubmenu(id);
  }

  function stopHoverTimer() {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = undefined;
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        role="menuitem"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        className={ENTRY_CLASS}
        onPointerMove={(event) => {
          if (disabled) {
            level.setOpenSubmenu(null);
            level.focusPanel();
            return;
          }
          event.currentTarget.focus();
          if (open || hoverTimer.current) return;
          hoverTimer.current = setTimeout(() => {
            hoverTimer.current = undefined;
            // The pointer moved to another entry when the focus left this one.
            if (document.activeElement === trigger.current) show(false);
          }, HOVER_DELAY_MS);
        }}
        onPointerLeave={() => {
          stopHoverTimer();
          if (!open) level.focusPanel();
        }}
        onClick={() => !disabled && show(true)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowRight' || disabled) return;
          event.preventDefault();
          show(true);
        }}
      >
        {label}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="ml-auto size-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 2.5 8 6l-3.5 3.5" />
        </svg>
      </button>
      {open && anchor && (
        <MenuPanel
          label={label}
          anchor={anchor}
          focusFirst={focusFirst}
          onArrowLeft={() => {
            level.setOpenSubmenu(null);
            trigger.current?.focus();
          }}
        >
          {children}
        </MenuPanel>
      )}
    </>
  );
}
