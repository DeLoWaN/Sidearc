import { type RefObject, useEffect } from 'react';

/** Calls `onEscape` each time the user presses Escape, while `active` is true. */
export function useEscape(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onEscape();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onEscape, active]);
}

/**
 * Calls `onDismiss` on a press outside `root`, and on Escape, while `active` is true.
 * `onEscape` replaces `onDismiss` for Escape.
 */
export function useDismiss(
  root: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  active = true,
  onEscape = onDismiss,
) {
  useEscape(onEscape, active);
  useEffect(() => {
    if (!active) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onDismiss();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [root, onDismiss, active]);
}
