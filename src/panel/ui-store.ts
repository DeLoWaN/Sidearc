import { create } from 'zustand';

/** What the panel itself remembers: no part of it goes to the worker. */
type PanelUi = {
  /** The right-click menu: the item it belongs to and where it opens. */
  menu?: { itemId: string; x: number; y: number };
  /** The item whose title the user is editing. */
  renamingId?: string;
  openMenu: (itemId: string, x: number, y: number) => void;
  closeMenu: () => void;
  startRename: (itemId: string) => void;
  stopRename: () => void;
};

export const usePanelUi = create<PanelUi>()((set) => ({
  openMenu: (itemId, x, y) => set({ menu: { itemId, x, y } }),
  closeMenu: () => set({ menu: undefined }),
  startRename: (itemId) => set({ renamingId: itemId }),
  stopRename: () => set({ renamingId: undefined }),
}));

/** Closes every menu and edit field. Tests need it: a store is one object per module. */
export const resetPanelUi = () => usePanelUi.setState({ menu: undefined, renamingId: undefined });
