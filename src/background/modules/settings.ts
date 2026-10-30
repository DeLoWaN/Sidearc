import type { SaveSettingsResult } from '../../shared/protocol';
import { parseSettingsPatch, readSettings } from '../../shared/settings';
import type { Settings } from '../../shared/types';
import { createQueue } from '../queue';
import { registerCommand, registerRpc } from '../registry';
import { notifyOnStorageChange, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';

const STORAGE_KEY = 'settings';

const saves = createQueue();

/** The stored settings. A setting that is not stored has its default. */
export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return readSettings(stored[STORAGE_KEY]);
}

/** Saves the given settings and keeps the others. Saves nothing when one value is not valid. */
export function saveSettings(patch: unknown): Promise<SaveSettingsResult> {
  const parsed = parseSettingsPatch(patch);
  if (!parsed.ok) return Promise.resolve(parsed);
  // Two saves at once would read the same old settings and lose one patch.
  return saves.run(async () => {
    const settings = { ...(await getSettings()), ...parsed.patch };
    await browser.storage.local.set({ [STORAGE_KEY]: settings });
    return { ok: true, settings };
  });
}

const settings: WorkerModule = {
  name: 'settings',
  order: 10,
  start() {
    registerSidebarSection('settings', async () => ({ settings: await getSettings() }));
    registerRpc('settings/get', () => getSettings());
    registerRpc('settings/save', (patch) => saveSettings(patch));
    registerCommand('options/open', () => browser.runtime.openOptionsPage());

    notifyOnStorageChange('local', STORAGE_KEY);
  },
};
export default settings;
