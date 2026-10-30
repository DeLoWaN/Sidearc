import { type RefObject, useEffect, useRef } from 'react';
import { usePanelDrag } from './dnd/drag-store';
import { usePanelStore } from './store';
import { arrangeUnpinned } from './tab-groups';

/** How long the panel keeps the new row in view. The worker may send a site group of the tab right after the tab. */
const FOLLOW_MS = 1000;

/** The ids of `current` that are not in `before`, in the order of `current`. */
export function findNewTabIds(before: ReadonlySet<number>, current: readonly number[]): number[] {
  return current.filter((id) => !before.has(id));
}

const isFullyVisible = (element: Element, scroller: Element | null) => {
  if (!scroller) return false;
  const box = element.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  return box.top >= view.top && box.bottom <= view.bottom;
};

/**
 * Scrolls the panel to the row of a tab that joins the Unpinned Tabs, when the row is not fully visible.
 * A new tab inside a collapsed group has no row: the header of the group scrolls into view instead.
 * Nothing scrolls for the first state of the worker, and nothing scrolls while the user drags.
 * The panel follows the new tab for one second, or until its row is fully visible.
 */
export function useRevealNewTabs(section: RefObject<HTMLElement | null>) {
  const loaded = usePanelStore((store) => store.loaded);
  const tabs = usePanelStore((store) => store.state.unpinnedTabs);
  const groups = usePanelStore((store) => store.state.tabGroups);
  const siteGroups = usePanelStore((store) => store.state.siteGroups);
  const known = useRef<Set<number> | null>(null);
  const following = useRef<{ id: number; until: number } | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const entries = arrangeUnpinned(tabs, groups, siteGroups);
    const ids = entries.flatMap((entry) =>
      entry.kind === 'tab' ? [entry.tab.id] : entry.tabs.map((tab) => tab.id),
    );
    const before = known.current;
    known.current = new Set(ids);
    const root = section.current;
    if (!before || !root || usePanelDrag.getState().source) {
      following.current = null;
      return;
    }

    /** The row of the tab, or the header of its group when the group is collapsed. */
    const elementOf = (id: number) => {
      const entry = entries.find((candidate) =>
        candidate.kind === 'tab'
          ? candidate.tab.id === id
          : candidate.tabs.some((t) => t.id === id),
      );
      const blockKey =
        entry && entry.kind !== 'tab' ? `${entry.kind}-${entry.group.id}` : undefined;
      return (
        root.querySelector(`[data-tab-id="${id}"]`) ??
        (blockKey ? root.querySelector(`[data-group-key="${blockKey}"]`) : null)
      );
    };

    const fresh = findNewTabIds(before, ids).find((id) => elementOf(id));
    if (fresh !== undefined) following.current = { id: fresh, until: Date.now() + FOLLOW_MS };
    const target =
      following.current && Date.now() <= following.current.until
        ? elementOf(following.current.id)
        : null;
    if (!target) {
      following.current = null;
      return;
    }
    if (isFullyVisible(target, root.closest('main'))) {
      if (fresh === undefined) following.current = null;
      return;
    }
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [loaded, tabs, groups, siteGroups, section]);
}
