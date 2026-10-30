import { create } from 'zustand';

/** Whether View Archive is open. The panel remembers it; the worker does not. */
type ArchiveUi = {
  open: boolean;
  openArchive: () => void;
  closeArchive: () => void;
};

export const useArchiveUi = create<ArchiveUi>()((set) => ({
  open: false,
  openArchive: () => set({ open: true }),
  closeArchive: () => set({ open: false }),
}));

/** Closes View Archive. The store is one object per module and keeps its state across tests. */
export const resetArchiveUi = () => useArchiveUi.setState({ open: false });
