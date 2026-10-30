import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../shared/settings';
import type { SidebarState } from '../shared/types';

type PanelStore = {
  state: SidebarState;
  /** False until the first state of the worker arrives: `state` is empty before that. */
  loaded: boolean;
  /** Replaces the state with the latest snapshot of the worker. Nothing else writes the state. */
  receive: (state: SidebarState) => void;
};

const emptyState: SidebarState = {
  // tabs
  unpinnedTabs: [],

  // items
  items: [],

  // tab groups
  tabGroups: [],

  // site groups
  siteGroups: [],

  // archive
  archive: [],

  // undo
  undo: null,

  // settings
  settings: DEFAULT_SETTINGS,
};

export const usePanelStore = create<PanelStore>()((set) => ({
  state: emptyState,
  loaded: false,
  receive: (state) => set({ state, loaded: true }),
}));

/** Puts the store back to its first state. The store is one object per module and keeps its state across tests. */
export const resetPanelStore = () => usePanelStore.setState({ state: emptyState, loaded: false });
