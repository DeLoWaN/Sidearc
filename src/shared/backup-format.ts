import { MAX_FAVORITES } from './item-tree';
import type { BackupSummary } from './protocol';
import { DEFAULT_SETTINGS, parseSettingsPatch } from './settings';
import type { ArchiveEntry, ItemKind, ItemRecord, Settings } from './types';
import { type Fail, fail, isObject, show } from './validation';

export const BACKUP_FORMAT = 'sidesweep-backup';
export const BACKUP_VERSION = 1;

/** The content of a backup file. */
export interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  /** When the file was made, as an ISO 8601 date. */
  exportedAt: string;
  items: ItemRecord[];
  settings: Settings;
  archive: ArchiveEntry[];
}

/** The name of the file that a backup is saved to: `sidesweep-backup-YYYY-MM-DD.json`, in local time. */
export function backupFileName(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${BACKUP_FORMAT}-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.json`;
}

const KINDS: Record<ItemKind, true> = { pinned: true, folder: true, favorite: true };
const ITEM_KINDS: readonly string[] = Object.keys(KINDS);

type FieldChecks = Record<string, [accepts: (value: unknown) => boolean, expected: string]>;

/** Returns the error text of the first field of `record` that has a wrong type, or undefined. */
function checkFields(
  record: Record<string, unknown>,
  path: string,
  checks: FieldChecks,
): string | undefined {
  for (const [name, [accepts, expected]] of Object.entries(checks)) {
    if (!accepts(record[name]))
      return `${path}.${name} must be ${expected}, got ${show(record[name])}`;
  }
  return undefined;
}

const isText = (value: unknown) => typeof value === 'string';
const isId = (value: unknown) => typeof value === 'string' && value !== '';

function parseItems(input: unknown): { ok: true; items: ItemRecord[] } | Fail {
  if (!Array.isArray(input)) return fail(`items must be a list, got ${show(input)}`);
  const items: ItemRecord[] = [];
  for (const [index, entry] of input.entries()) {
    const path = `items[${index}]`;
    if (!isObject(entry)) return fail(`${path} must be an object, got ${show(entry)}`);
    const error = checkFields(entry, path, {
      id: [isId, 'a text that is not empty'],
      kind: [(value) => ITEM_KINDS.includes(value as string), 'pinned, folder or favorite'],
      title: [isText, 'a text'],
      url: [isText, 'a text'],
      parentId: [(value) => value === null || isId(value), 'a text or null'],
      position: [(value) => Number.isInteger(value) && (value as number) >= 0, 'a whole number'],
      collapsed: [(value) => typeof value === 'boolean', 'true or false'],
    });
    if (error) return fail(error);
    items.push({
      id: entry.id as string,
      kind: entry.kind as ItemKind,
      title: entry.title as string,
      url: entry.url as string,
      parentId: entry.parentId as string | null,
      position: entry.position as number,
      collapsed: entry.collapsed as boolean,
    });
  }
  return { ok: true, items };
}

/** Checks that the items make one tree: unique ids, parents that are Folders, no loop, 12 Favorites at most. */
function checkTree(items: ItemRecord[]): string | undefined {
  const byId = new Map<string, ItemRecord>();
  for (const [index, item] of items.entries()) {
    if (byId.has(item.id)) return `items[${index}].id ${show(item.id)} is used twice`;
    byId.set(item.id, item);
  }
  for (const [index, item] of items.entries()) {
    if (item.kind === 'favorite' && item.parentId !== null)
      return `items[${index}].parentId must be null for a Favorite, got ${show(item.parentId)}`;
    if (item.parentId === null) continue;
    const parent = byId.get(item.parentId);
    if (!parent) return `items[${index}].parentId ${show(item.parentId)} is not the id of an item`;
    if (parent.kind !== 'folder')
      return `items[${index}].parentId ${show(item.parentId)} is not the id of a Folder`;
  }
  for (const item of items) {
    const seen = new Set([item.id]);
    for (let up = item.parentId; up !== null; up = (byId.get(up) as ItemRecord).parentId) {
      if (seen.has(up))
        return `items[${items.indexOf(byId.get(up) as ItemRecord)}] is inside itself: its parents make a loop`;
      seen.add(up);
    }
  }
  const favorites = items.filter((item) => item.kind === 'favorite').length;
  if (favorites > MAX_FAVORITES)
    return `items holds ${favorites} Favorites, but a profile has ${MAX_FAVORITES} at most`;
  return undefined;
}

function parseSettings(input: unknown): { ok: true; settings: Settings } | Fail {
  const parsed = parseSettingsPatch(input);
  if (!parsed.ok) return fail(`settings: ${parsed.error}`);
  return { ok: true, settings: { ...DEFAULT_SETTINGS, ...parsed.patch } };
}

function parseArchive(input: unknown): { ok: true; archive: ArchiveEntry[] } | Fail {
  if (!Array.isArray(input)) return fail(`archive must be a list, got ${show(input)}`);
  const archive: ArchiveEntry[] = [];
  for (const [index, entry] of input.entries()) {
    const path = `archive[${index}]`;
    if (!isObject(entry)) return fail(`${path} must be an object, got ${show(entry)}`);
    const error = checkFields(entry, path, {
      id: [isId, 'a text that is not empty'],
      url: [isText, 'a text'],
      title: [isText, 'a text'],
      iconUrl: [isText, 'a text'],
      closedAt: [(value) => Number.isFinite(value), 'a number'],
    });
    if (error) return fail(error);
    archive.push({
      id: entry.id as string,
      url: entry.url as string,
      title: entry.title as string,
      iconUrl: entry.iconUrl as string,
      closedAt: entry.closedAt as number,
    });
  }
  return { ok: true, archive };
}

/** What a backup text holds, once it passed every check. */
interface ParsedBackup {
  items: ItemRecord[];
  settings: Settings;
  archive: ArchiveEntry[];
}

/**
 * Checks the text of a backup file.
 * Returns the clean data, or the first error. The error names the field by its path.
 */
export function parseBackup(text: string): { ok: true; backup: ParsedBackup } | Fail {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return fail('The file is not valid JSON');
  }
  if (!isObject(document))
    return fail('The file is not a Sidesweep backup: it must hold an object');
  if (document.format !== BACKUP_FORMAT)
    return fail(
      `The file is not a Sidesweep backup: format must be ${show(BACKUP_FORMAT)}, got ${show(document.format)}`,
    );
  if (document.version !== BACKUP_VERSION)
    return fail(
      `Unknown backup version ${show(document.version)}: this Sidesweep reads version ${BACKUP_VERSION}`,
    );

  const items = parseItems(document.items);
  if (!items.ok) return items;
  const treeError = checkTree(items.items);
  if (treeError) return fail(treeError);
  const settings = parseSettings(document.settings);
  if (!settings.ok) return settings;
  const archive = parseArchive(document.archive);
  if (!archive.ok) return archive;

  return {
    ok: true,
    backup: { items: items.items, settings: settings.settings, archive: archive.archive },
  };
}

/** Counts the content of a backup, for the confirmation question. */
export function summarizeBackup({ items, archive }: ParsedBackup): BackupSummary {
  const count = (kind: string) => items.filter((item) => item.kind === kind).length;
  return {
    favorites: count('favorite'),
    pinnedTabs: count('pinned'),
    folders: count('folder'),
    archivedTabs: archive.length,
  };
}
