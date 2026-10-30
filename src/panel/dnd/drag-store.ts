import { create } from 'zustand';
import type { DragSource } from './types';

/** What the user drags now, or null. A section that is empty shows a place to drop while this is set. */
export const usePanelDrag = create<{ source: DragSource | null }>()(() => ({ source: null }));

/** Tests need it: a store is one object per module. */
export const resetPanelDrag = () => usePanelDrag.setState({ source: null });
