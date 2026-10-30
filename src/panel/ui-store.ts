import { create } from 'zustand';
import { isSearching } from './search';

/** What the panel itself remembers: no part of it goes to the worker. */
type PanelUi = {
  /**
   * The right-click menu: the item it belongs to (null for the root of the Pinned Tabs), where it opens,
   * and the element that gets the focus back when the user dismisses it.
   */
  menu?: { itemId: string | null; x: number; y: number; opener: HTMLElement | null };
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
  /** The toast that offers to undo what the user just did, for example `Deleted "Mail"`. */
  undoToast?: string;
  setSearchQuery: (query: string) => void;
  showUndoToast: (message: string) => void;
  dismissUndoToast: () => void;
  showNotice: (message: string) => void;
  dismissNotice: () => void;
  openMenu: (itemId: string | null, x: number, y: number, opener: HTMLElement | null) => void;
  closeMenu: () => void;
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
  showUndoToast: (message) => set({ undoToast: message }),
  dismissUndoToast: () => set({ undoToast: undefined }),
  showNotice: (message) => set({ notice: message }),
  dismissNotice: () => set({ notice: undefined }),
  openMenu: (itemId, x, y, opener) => set({ menu: { itemId, x, y, opener } }),
  closeMenu: () => set({ menu: undefined }),
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
    renamingId: undefined,
    creatingIn: undefined,
    confirmingDeleteId: undefined,
    notice: undefined,
    undoToast: undefined,
    searchQuery: '',
    searching: false,
  });
