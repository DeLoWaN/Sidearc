import { create } from 'zustand';
import type { SidebarState } from '../shared/types';

type PanelStore = {
  state: SidebarState;
  /** Replaces the state with the latest snapshot of the worker. Nothing else writes the state. */
  receive: (state: SidebarState) => void;
};

const emptyState: SidebarState = {
  // tabs (#3)
  unpinnedTabs: [],

  // items (#4, #5, #6)

  // tab groups (#9)

  // settings (#14)
};

export const usePanelStore = create<PanelStore>()((set) => ({
  state: emptyState,
  receive: (state) => set({ state }),
}));

/** Puts the store back to its first state. Tests need it: a store is one object per module. */
export const resetPanelStore = () => usePanelStore.setState({ state: emptyState });
