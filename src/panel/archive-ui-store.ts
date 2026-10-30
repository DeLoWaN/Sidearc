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

/** Closes View Archive. Tests need it: a store is one object per module. */
export const resetArchiveUi = () => useArchiveUi.setState({ open: false });
