import { create } from 'zustand';
import type { DragSource } from './types';

/** What the user drags now, or null. A section that is empty shows a place to drop while this is set. */
export const usePanelDrag = create<{ source: DragSource | null }>()(() => ({ source: null }));

/** Clears the drag source. The store is one object per module and keeps its state across tests. */
export const resetPanelDrag = () => usePanelDrag.setState({ source: null });
