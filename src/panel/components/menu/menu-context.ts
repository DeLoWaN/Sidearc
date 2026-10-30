import { createContext, useContext } from 'react';

/** What every entry of a menu tree shares. */
export type MenuRoot = {
  /** Closes the whole menu tree. */
  close: () => void;
  /** Closes the whole menu tree and gives the focus back to the element that opened it. */
  dismiss: () => void;
};

/** What the entries of one menu level share: the level is the root menu or one submenu. */
export type MenuLevel = {
  /** The id of the submenu that is open in this level, if any. */
  openSubmenu: string | null;
  setOpenSubmenu: (id: string | null) => void;
  /** Takes the focus off the entries, so that no entry looks active. */
  focusPanel: () => void;
};

export const MenuRootContext = createContext<MenuRoot | null>(null);
export const MenuLevelContext = createContext<MenuLevel | null>(null);

function required<T>(value: T | null): T {
  if (value === null) throw new Error('A menu entry must be inside a ContextMenu.');
  return value;
}

export const useMenuRoot = () => required(useContext(MenuRootContext));
export const useMenuLevel = () => required(useContext(MenuLevelContext));
