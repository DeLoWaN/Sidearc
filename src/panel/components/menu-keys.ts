import { type KeyboardEvent, type RefObject, useEffect } from 'react';

const ENTRY = '[role="menuitem"]:not(:disabled)';

/** Puts the focus on the first entry of the menu each time `open` turns true. */
export function useFocusFirstEntry(root: RefObject<HTMLElement | null>, open: unknown) {
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>(ENTRY)?.focus();
  }, [root, open]);
}

/** The arrow keys, Home and End move the focus between the entries of a menu. */
export function moveFocusWithKeys(event: KeyboardEvent<HTMLElement>) {
  const entries = [...event.currentTarget.querySelectorAll<HTMLElement>(ENTRY)];
  const index = entries.indexOf(document.activeElement as HTMLElement);
  const target = {
    ArrowDown: entries[(index + 1) % entries.length],
    ArrowUp: entries[(index - 1 + entries.length) % entries.length],
    Home: entries[0],
    End: entries.at(-1),
  }[event.key];
  if (!target) return;
  event.preventDefault();
  target.focus();
}
