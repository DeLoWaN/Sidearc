import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupDocument,
  parseBackup,
  summarizeBackup,
} from '../../shared/backup-format';
import type { BackupCheckResult } from '../../shared/protocol';
import { registerRpc } from '../registry';
import { notifySidebarChanged } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';
import { getArchive } from './archive-store';
import { getItems } from './item-store';
import { clearLiveTabs } from './live-tab-registry';
import { relinkOpenTabs } from './relink';
import { getSettings } from './settings';

/** The text of a backup file with all the data of Sidearc. The live tabs are not part of it. */
export async function exportBackup(): Promise<string> {
  const [items, settings, archive] = await Promise.all([getItems(), getSettings(), getArchive()]);
  const backup: BackupDocument = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    settings,
    archive,
  };
  return JSON.stringify(backup, null, 2);
}

/** Checks the text of a backup file and counts its content. Changes nothing. */
export function inspectBackup(text: string): BackupCheckResult {
  const parsed = parseBackup(text);
  return parsed.ok ? { ok: true, summary: summarizeBackup(parsed.backup) } : parsed;
}

/**
 * Replaces the items, the settings and the archive with the content of a backup file.
 * Changes nothing when the text is not a valid backup. Every item is at rest after the import,
 * then each open tab with the saved URL of an item becomes its live tab.
 */
export async function importBackup(text: string): Promise<BackupCheckResult> {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  const { items, settings, archive } = parsed.backup;

  // One call to `set` writes the three keys together or none.
  await browser.storage.local.set({ items, settings, archive });
  await clearLiveTabs();
  await relinkOpenTabs();
  notifySidebarChanged();
  return { ok: true, summary: summarizeBackup(parsed.backup) };
}

const backup: WorkerModule = {
  name: 'backup',
  order: 40,
  start() {
    registerRpc('backup/export', () => exportBackup());
    registerRpc('backup/inspect', (text) => inspectBackup(text));
    registerRpc('backup/import', (text) => importBackup(text));
  },
};
export default backup;
