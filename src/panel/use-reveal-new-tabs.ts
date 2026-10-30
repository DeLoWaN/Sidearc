import { type RefObject, useEffect, useRef } from 'react';
import { usePanelDrag } from './dnd/drag-store';
import { usePanel } from './panel-context';
import { usePanelStore } from './store';
import { arrangeUnpinned } from './tab-groups';

/** How long a new tab must stay in the list before the panel scrolls to it. A tab that opens a Pinned Tab leaves the list sooner. */
const REVEAL_DELAY_MS = 300;

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
 * It waits 300 ms first, and it skips a tab that left the list or is the active tab of its window by then.
 * A new tab inside a collapsed group has no row: the header of the group scrolls into view instead.
 * Nothing scrolls for the first state of the worker, and nothing scrolls while the user drags.
 * The panel follows the new tab for one second, or until its row is fully visible.
 */
export function useRevealNewTabs(section: RefObject<HTMLElement | null>) {
  const { windowId } = usePanel();
  const loaded = usePanelStore((store) => store.loaded);
  const tabs = usePanelStore((store) => store.state.unpinnedTabs);
  const groups = usePanelStore((store) => store.state.tabGroups);
  const siteGroups = usePanelStore((store) => store.state.siteGroups);
  const known = useRef<Set<number> | null>(null);
  const following = useRef<{ id: number; until: number } | null>(null);
  /** New tabs that wait for the delay, with the time they appeared. */
  const waiting = useRef(new Map<number, number>());

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
      waiting.current.clear();
      return;
    }
    for (const id of waiting.current.keys()) if (!ids.includes(id)) waiting.current.delete(id);
    for (const id of findNewTabIds(before, ids)) waiting.current.set(id, Date.now());

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

    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Judges the waiting tabs, then scrolls. It runs again when the next waiting tab is old enough. */
    const check = () => {
      const now = Date.now();
      let ready: number | undefined;
      let wait: number | undefined;
      for (const [id, since] of waiting.current) {
        const age = now - since;
        if (age < REVEAL_DELAY_MS) {
          wait = Math.min(wait ?? REVEAL_DELAY_MS, REVEAL_DELAY_MS - age);
          continue;
        }
        waiting.current.delete(id);
        const tab = tabs.find((candidate) => candidate.id === id);
        // The user looks at the active tab of this window already.
        if (tab && !(tab.active && tab.windowId === windowId) && elementOf(id)) ready = id;
      }
      if (wait !== undefined) timer = setTimeout(check, wait);

      if (ready !== undefined) following.current = { id: ready, until: now + FOLLOW_MS };
      const target =
        following.current && now <= following.current.until
          ? elementOf(following.current.id)
          : null;
      if (!target) {
        following.current = null;
      } else if (isFullyVisible(target, root.closest('main'))) {
        if (ready === undefined) following.current = null;
      } else {
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };
    check();
    return () => clearTimeout(timer);
  }, [loaded, tabs, groups, siteGroups, section, windowId]);
}
