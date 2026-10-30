import type { SaveSettingsResult } from '../../shared/protocol';
import { parseSettingsPatch, readSettings } from '../../shared/settings';
import type { Settings } from '../../shared/types';
import { registerCommand, registerRpc } from '../registry';
import { notifySidebarChanged, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';

const STORAGE_KEY = 'settings';

/** The stored settings. A setting that is not stored has its default. */
export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return readSettings(stored[STORAGE_KEY]);
}

/** Saves the given settings and keeps the others. Saves nothing when one value is not valid. */
export async function saveSettings(patch: unknown): Promise<SaveSettingsResult> {
  const parsed = parseSettingsPatch(patch);
  if (!parsed.ok) return parsed;
  const settings = { ...(await getSettings()), ...parsed.patch };
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
  return { ok: true, settings };
}

const settings: WorkerModule = {
  name: 'settings',
  order: 10,
  start() {
    registerSidebarSection('settings', async () => ({ settings: await getSettings() }));
    registerRpc('settings/get', () => getSettings());
    registerRpc('settings/save', (patch) => saveSettings(patch));
    registerCommand('options/open', () => browser.runtime.openOptionsPage());

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && STORAGE_KEY in changes) notifySidebarChanged();
    });
  },
};
export default settings;
