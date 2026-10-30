import type { WorkerModule } from '../worker-module';

const STORAGE_KEY = 'settings';

export interface Settings {
  /** Hours without a visit before Auto Archive closes an Unpinned Tab. */
  autoArchiveHours: number;
}

export const DEFAULT_SETTINGS: Settings = { autoArchiveHours: 12 };

/** The stored settings. A setting that is not stored has its default. */
export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] as Partial<Settings> | undefined) };
}

const settings: WorkerModule = {
  name: 'settings',
  order: 10,
  // Settings are read on demand: nothing to register.
  start() {},
};
export default settings;
