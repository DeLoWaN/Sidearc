import type { ArchiveEntry } from '../../shared/types';
import { createQueue } from '../queue';
import { registerCommand } from '../registry';
import { notifySidebarChanged, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';

const STORAGE_KEY = 'archive';

export const ARCHIVE_RETENTION_MS = 30 * 24 * 3600 * 1000;

// Two writes in a row would both read the old list. The queue makes them take turns.
const writes = createQueue();

// A second click on one entry must find the entry gone, so it opens no second tab.
const reopens = createQueue();

async function readEntries(): Promise<ArchiveEntry[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as ArchiveEntry[] | undefined) ?? [];
}

const isFresh = (entry: ArchiveEntry) => entry.closedAt > Date.now() - ARCHIVE_RETENTION_MS;

/** The entries of the last 30 days, the latest first. */
export async function getArchive(): Promise<ArchiveEntry[]> {
  return (await readEntries()).filter(isFresh);
}

async function change(update: (entries: ArchiveEntry[]) => ArchiveEntry[]) {
  await writes.run(async () => {
    const entries = update((await readEntries()).filter(isFresh));
    await browser.storage.local.set({ [STORAGE_KEY]: entries });
  });
}

/** Adds the tabs to the archive, closed now. The first tab of the list is the latest. */
export async function addArchiveEntries(entries: Omit<ArchiveEntry, 'id' | 'closedAt'>[]) {
  const closedAt = Date.now();
  const added = entries.map((entry) => ({ ...entry, id: crypto.randomUUID(), closedAt }));
  await change((current) => [...added, ...current]);
}

export async function removeArchiveEntry(id: string) {
  await change((entries) => entries.filter((entry) => entry.id !== id));
}

const archiveStore: WorkerModule = {
  name: 'archive-store',
  order: 10,
  start() {
    registerSidebarSection('archive', async () => ({ archive: await getArchive() }));

    registerCommand('archive/reopen', ({ entryId, windowId }) =>
      reopens.run(async () => {
        const entry = (await getArchive()).find((candidate) => candidate.id === entryId);
        if (!entry) return;
        await browser.tabs.create({ windowId, url: entry.url, active: true });
        await removeArchiveEntry(entry.id);
      }),
    );

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && STORAGE_KEY in changes) notifySidebarChanged();
    });
  },
};
export default archiveStore;
