import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useDismiss } from '../../../ui/use-dismiss';
import { MenuPanel } from './MenuPanel';
import { MenuRootContext } from './menu-context';

/**
 * A menu at a place on screen, made of MenuItem, SubMenu and MenuSeparator.
 * It holds no rule about what the entries do.
 * It calls `onClose` on Escape, on Tab, on a press outside, when the window loses focus and when an entry runs.
 * Escape and Tab give the focus back to `returnFocusTo`, or to the element that had the focus at the start.
 */
export function ContextMenu({
  label,
  x,
  y,
  returnFocusTo,
  onClose,
  children,
}: {
  label: string;
  x: number;
  y: number;
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [opener] = useState(() => returnFocusTo ?? document.activeElement);
  const dismiss = () => {
    onClose();
    if (opener instanceof HTMLElement) opener.focus();
  };
  useDismiss(root, onClose, true, dismiss);
  useEffect(() => {
    window.addEventListener('blur', onClose);
    return () => window.removeEventListener('blur', onClose);
  }, [onClose]);

  return (
    <MenuRootContext value={{ close: onClose, dismiss }}>
      <MenuPanel
        ref={root}
        label={label}
        anchor={{ left: x, top: y, right: x, bottom: y }}
        focusFirst
      >
        {children}
      </MenuPanel>
    </MenuRootContext>
  );
}
