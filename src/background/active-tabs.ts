import { createQueue } from './queue';

const STORAGE_KEY = 'activeTabs';

/** For each window id, the active tab and the tab that was active before it. */
type ActiveTabs = Record<string, { current: number; previous?: number }>;

// Session storage keeps the record when Chrome stops the worker, so a worker that a new tab wakes still knows the older tab.
const access = createQueue();

async function read(): Promise<ActiveTabs> {
  const stored = await browser.storage.session.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as ActiveTabs | undefined) ?? {};
}

/** Records that the tab became the active tab of its window. */
export function noteActiveTab(windowId: number, tabId: number): Promise<void> {
  return access
    .run(async () => {
      const record = await read();
      const known = record[windowId];
      if (known?.current === tabId) return;
      record[windowId] = { current: tabId, ...(known ? { previous: known.current } : {}) };
      await browser.storage.session.set({ [STORAGE_KEY]: record });
    })
    .catch(console.error);
}

/** Records the active tab of each window that the record does not know yet. Call it when the worker starts. */
export function noteOpenWindows(): Promise<void> {
  return access
    .run(async () => {
      const record = await read();
      const missing = (await browser.tabs.query({ active: true })).filter(
        (tab) => tab.id !== undefined && !record[tab.windowId],
      );
      if (missing.length === 0) return;
      for (const tab of missing) record[tab.windowId] = { current: tab.id as number };
      await browser.storage.session.set({ [STORAGE_KEY]: record });
    })
    .catch(console.error);
}

/** The active tab of the window and the one before it. Empty when the worker knows none. */
export function activeTabsOf(windowId: number): Promise<number[]> {
  return access.run(async () => {
    const entry = (await read())[windowId];
    return entry ? [entry.current, ...(entry.previous === undefined ? [] : [entry.previous])] : [];
  });
}
