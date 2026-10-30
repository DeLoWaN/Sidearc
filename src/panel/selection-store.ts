import { create } from 'zustand';
import type { SidebarState } from '../shared/types';

/** One selected row: an Unpinned Tab, or an item (a Pinned Tab or a Folder). */
export type SelectionId = { kind: 'tab'; id: number } | { kind: 'item'; id: string };

const sameId = (a: SelectionId, b: SelectionId) => a.kind === b.kind && a.id === b.id;

type PanelSelection = {
  /** The selected rows, in the order of the clicks. */
  selected: SelectionId[];
  /** The last row that the user clicked with Ctrl, Cmd or Shift. A Shift click starts its range here. */
  anchor?: SelectionId;
  /** The right-click menu of the selection: where it opens, and the element that gets the focus back. */
  menu?: { x: number; y: number; opener: HTMLElement | null };
  /** True while the panel asks the user to confirm the close of a selection that holds a Folder. */
  confirmingClose: boolean;
  /** Adds the row, or removes it when it is selected. The row becomes the anchor. */
  toggle: (id: SelectionId) => void;
  /** Replaces the selection with these rows. `anchor` becomes the anchor. */
  replace: (ids: SelectionId[], anchor: SelectionId) => void;
  /** Keeps the rows that the state still shows. */
  prune: (state: SidebarState) => void;
  clear: () => void;
  openMenu: (x: number, y: number, opener: HTMLElement | null) => void;
  closeMenu: () => void;
  askCloseConfirmation: () => void;
  cancelCloseConfirmation: () => void;
};

/** The rows the user selected. No part of it goes to the worker. */
export const usePanelSelection = create<PanelSelection>()((set) => ({
  selected: [],
  confirmingClose: false,
  toggle: (id) =>
    set((selection) => ({
      selected: selection.selected.some((other) => sameId(other, id))
        ? selection.selected.filter((other) => !sameId(other, id))
        : [...selection.selected, id],
      anchor: id,
    })),
  replace: (ids, anchor) => set({ selected: ids, anchor }),
  prune: (state) =>
    set((selection) => {
      const tabs = new Set(state.unpinnedTabs.map((tab) => tab.id));
      const items = new Set(
        state.items.filter((item) => item.kind !== 'favorite').map((item) => item.id),
      );
      const selected = selection.selected.filter((row) =>
        row.kind === 'tab' ? tabs.has(row.id) : items.has(row.id),
      );
      if (selected.length === selection.selected.length) return selection;
      return {
        selected,
        anchor:
          selection.anchor && selected.some((row) => sameId(row, selection.anchor as SelectionId))
            ? selection.anchor
            : undefined,
        ...(selected.length === 0 ? { menu: undefined, confirmingClose: false } : {}),
      };
    }),
  clear: () =>
    set((selection) =>
      selection.selected.length === 0 && !selection.menu && !selection.confirmingClose
        ? selection
        : { selected: [], anchor: undefined, menu: undefined, confirmingClose: false },
    ),
  openMenu: (x, y, opener) => set({ menu: { x, y, opener } }),
  closeMenu: () => set({ menu: undefined }),
  askCloseConfirmation: () => set({ confirmingClose: true }),
  cancelCloseConfirmation: () => set({ confirmingClose: false }),
}));

/** Empties the selection. The store is one object per module and keeps its state across tests. */
export const resetPanelSelection = () =>
  usePanelSelection.setState({
    selected: [],
    anchor: undefined,
    menu: undefined,
    confirmingClose: false,
  });
