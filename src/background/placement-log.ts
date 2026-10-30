import type { PlacementLogEntry } from '../shared/protocol';
import { createQueue } from './queue';

const STORAGE_KEY = 'placementLog';

/** The log keeps this many entries. A new entry pushes out the oldest one. */
export const PLACEMENT_LOG_SIZE = 40;

const writes = createQueue();

/** The entries of the log, the oldest first. Session storage keeps them when the worker stops, not when Chrome quits. */
export async function readPlacementLog(): Promise<PlacementLogEntry[]> {
  const stored = await browser.storage.session.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as PlacementLogEntry[] | undefined) ?? [];
}

/** Adds an entry to the log. A failed write is reported to the console and never throws. */
export function recordPlacement(entry: PlacementLogEntry): Promise<void> {
  return writes
    .run(async () => {
      const log = [...(await readPlacementLog()), entry].slice(-PLACEMENT_LOG_SIZE);
      await browser.storage.session.set({ [STORAGE_KEY]: log });
    })
    .catch(console.error);
}
