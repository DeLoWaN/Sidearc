import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { MenuLevelContext, useMenuRoot } from './menu-context';
import { type Box, placeMenu } from './place-menu';

/** The entries of one menu level, without the entries of a submenu inside it. */
export function entriesOf(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
    (entry) =>
      entry.closest('[role="menu"]') === panel && entry.getAttribute('aria-disabled') !== 'true',
  );
}

/** One menu box: the root menu or a submenu. It keeps the state of its own level. */
export function MenuPanel({
  label,
  anchor,
  focusFirst,
  onArrowLeft,
  ref,
  children,
}: {
  label: string;
  /** The point or the parent entry that the box opens next to. */
  anchor: Box;
  /** Moves the focus to the first entry when the panel appears. */
  focusFirst: boolean;
  /** Runs on ArrowLeft. Only a submenu needs it. */
  onArrowLeft?: () => void;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const root = useMenuRoot();
  const panel = useRef<HTMLDivElement | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [place, setPlace] = useState<ReturnType<typeof placeMenu>>();
  const { left, top, right, bottom } = anchor;

  // The box is measured at the corner, where the edge of the panel cannot squeeze it.
  useLayoutEffect(() => {
    if (!panel.current) return;
    const { width, height } = panel.current.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    setPlace(placeMenu({ left, top, right, bottom }, { width, height }, viewport));
  }, [left, top, right, bottom]);

  useEffect(() => {
    if (focusFirst && panel.current) entriesOf(panel.current)[0]?.focus();
  }, [focusFirst]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The key of an entry in a submenu bubbles up through here: the submenu handles it.
    if ((event.target as Element).closest('[role="menu"]') !== event.currentTarget) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      root.dismiss();
      return;
    }
    if (event.key === 'ArrowLeft' && onArrowLeft) {
      event.preventDefault();
      onArrowLeft();
      return;
    }
    const entries = entriesOf(event.currentTarget);
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const target = {
      ArrowDown: entries[(index + 1) % entries.length],
      ArrowUp:
        entries[index === -1 ? entries.length - 1 : (index - 1 + entries.length) % entries.length],
      Home: entries[0],
      End: entries.at(-1),
    }[event.key];
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  return (
    <MenuLevelContext
      value={{ openSubmenu, setOpenSubmenu, focusPanel: () => panel.current?.focus() }}
    >
      <div
        ref={(element) => {
          panel.current = element;
          if (typeof ref === 'function') ref(element);
          else if (ref) ref.current = element;
        }}
        role="menu"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        // Before the first measure the box waits at the corner, hidden.
        style={place ?? { left: 0, top: 0, visibility: 'hidden' }}
        className="fixed z-10 min-w-40 overflow-y-auto rounded-xl bg-(--menu-bg) p-1 shadow-lg ring-1 ring-black/5 outline-none"
      >
        {children}
      </div>
    </MenuLevelContext>
  );
}
