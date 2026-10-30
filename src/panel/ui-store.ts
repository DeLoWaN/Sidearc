import { create } from 'zustand';
import { isSearching } from './search';

/** What the panel itself remembers: no part of it goes to the worker. */
type PanelUi = {
  /** The right-click menu: the item it belongs to (null for the root of the Pinned Tabs) and where it opens. */
  menu?: { itemId: string | null; x: number; y: number };
  /** The "Move to…" menu of an item and where it opens. */
  moveMenu?: { itemId: string; x: number; y: number };
  /** The item whose title the user is editing. */
  renamingId?: string;
  /** The Folder (null for the root) that is getting a new Folder: the panel shows a name field in it. */
  creatingIn?: { parentId: string | null };
  /** The Folder that waits for the user to confirm its deletion. */
  confirmingDeleteId?: string;
  /** The text in the search field, as typed. */
  searchQuery: string;
  /** True while the search field has text other than spaces: the panel shows results, and drags are off. */
  searching: boolean;
  /** A short text from the worker, for example that it refused a command. */
  notice?: string;
  setSearchQuery: (query: string) => void;
  showNotice: (message: string) => void;
  dismissNotice: () => void;
  openMenu: (itemId: string | null, x: number, y: number) => void;
  closeMenu: () => void;
  openMoveMenu: (itemId: string, x: number, y: number) => void;
  closeMoveMenu: () => void;
  startRename: (itemId: string) => void;
  stopRename: () => void;
  startCreateFolder: (parentId: string | null) => void;
  stopCreateFolder: () => void;
  askDeleteConfirmation: (itemId: string) => void;
  cancelDelete: () => void;
};

export const usePanelUi = create<PanelUi>()((set) => ({
  searchQuery: '',
  searching: false,
  setSearchQuery: (query) => set({ searchQuery: query, searching: isSearching(query) }),
  showNotice: (message) => set({ notice: message }),
  dismissNotice: () => set({ notice: undefined }),
  openMenu: (itemId, x, y) => set({ menu: { itemId, x, y } }),
  closeMenu: () => set({ menu: undefined }),
  openMoveMenu: (itemId, x, y) => set({ moveMenu: { itemId, x, y } }),
  closeMoveMenu: () => set({ moveMenu: undefined }),
  startRename: (itemId) => set({ renamingId: itemId }),
  stopRename: () => set({ renamingId: undefined }),
  startCreateFolder: (parentId) => set({ creatingIn: { parentId } }),
  stopCreateFolder: () => set({ creatingIn: undefined }),
  askDeleteConfirmation: (itemId) => set({ confirmingDeleteId: itemId }),
  cancelDelete: () => set({ confirmingDeleteId: undefined }),
}));

/** Closes every menu and edit field. The store is one object per module and keeps its state across tests. */
export const resetPanelUi = () =>
  usePanelUi.setState({
    menu: undefined,
    moveMenu: undefined,
    renamingId: undefined,
    creatingIn: undefined,
    confirmingDeleteId: undefined,
    notice: undefined,
    searchQuery: '',
    searching: false,
  });
