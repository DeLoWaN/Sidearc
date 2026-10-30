import { endPosition, isFolderOrRoot, MAX_FAVORITES, subtreeIds } from '../../shared/item-tree';
import type { ItemKind, ItemRecord } from '../../shared/types';
import { createQueue } from '../queue';
import { registerCommand } from '../registry';
import { notifySidebarChanged } from '../sidebar-hub';
import { UserError } from '../user-error';
import type { WorkerModule } from '../worker-module';

const STORAGE_KEY = 'items';

/** The profile has 12 Favorites already. */
export class FavoriteLimitError extends UserError {
  constructor() {
    super(`Sidearc keeps ${MAX_FAVORITES} Favorites at most. Remove one first.`);
  }
}

const countFavorites = (items: ItemRecord[]) =>
  items.filter((item) => item.kind === 'favorite').length;

// Two writes in a row would both read the old list. The queue makes them take turns.
const writes = createQueue();

async function readItems(): Promise<ItemRecord[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as ItemRecord[] | undefined) ?? [];
}

/** Every item, ordered by position. */
export async function getItems(): Promise<ItemRecord[]> {
  const items = await readItems();
  return items.sort((a, b) => a.position - b.position);
}

async function change(update: (items: ItemRecord[]) => ItemRecord[]) {
  await writes.run(async () => {
    await browser.storage.local.set({ [STORAGE_KEY]: update(await readItems()) });
  });
}

/**
 * Adds an item at the end of its parent. Returns it with the id that Sidearc made.
 * A Favorite has no parent and goes at the end of the Favorites.
 * Throws, and adds nothing, when the parent is not a Folder, or when 12 Favorites exist.
 */
export async function addItem(input: {
  kind: ItemKind;
  title: string;
  url: string;
  parentId?: string | null;
}): Promise<ItemRecord> {
  const favorite = input.kind === 'favorite';
  const parentId = favorite ? null : (input.parentId ?? null);
  let added: ItemRecord | undefined;
  await change((items) => {
    if (!isFolderOrRoot(items, parentId)) throw new Error(`Not a Folder: ${parentId}`);
    if (favorite && countFavorites(items) >= MAX_FAVORITES) throw new FavoriteLimitError();
    added = {
      id: crypto.randomUUID(),
      kind: input.kind,
      title: input.title,
      url: input.url,
      parentId,
      position: endPosition(items, parentId, favorite),
      collapsed: false,
    };
    return [...items, added];
  });
  return added as ItemRecord;
}

/** Gives the item a new title. Ignores a blank title and an unknown item. */
export async function renameItem(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await change((items) =>
    items.map((item) => (item.id === id ? { ...item, title: trimmed } : item)),
  );
}

/** Collapses an open Folder or opens a collapsed one. Ignores anything that is not a Folder. */
export async function toggleFolder(id: string) {
  await change((items) =>
    items.map((item) =>
      item.id === id && item.kind === 'folder' ? { ...item, collapsed: !item.collapsed } : item,
    ),
  );
}

/**
 * Puts the item at the end of another Folder, or at the root when `parentId` is null.
 * A Favorite becomes a Pinned Tab at that place.
 * Does nothing when the target is not a Folder, is the item itself or lies below it.
 */
export async function moveItem(id: string, parentId: string | null) {
  await change((items) => {
    const moved = items.find((item) => item.id === id);
    if (!moved || !isFolderOrRoot(items, parentId)) return items;
    const wasFavorite = moved.kind === 'favorite';
    if (!wasFavorite && moved.parentId === parentId) return items;
    if (parentId !== null && subtreeIds(items, id).has(parentId)) return items;
    const position = endPosition(items, parentId);
    const kind = wasFavorite ? 'pinned' : moved.kind;
    return items.map((item) => (item.id === id ? { ...item, kind, parentId, position } : item));
  });
}

/**
 * Turns a Pinned Tab into a Favorite at the end of the Favorites. The item keeps its id, so its live tab stays.
 * Ignores a Folder, a Favorite and an unknown item. Throws when 12 Favorites exist.
 */
export async function makeFavorite(id: string) {
  await change((items) => {
    const moved = items.find((item) => item.id === id);
    if (moved?.kind !== 'pinned') return items;
    if (countFavorites(items) >= MAX_FAVORITES) throw new FavoriteLimitError();
    const position = endPosition(items, null, true);
    return items.map((item) =>
      item.id === id ? { ...item, kind: 'favorite', parentId: null, position } : item,
    );
  });
}

/** Deletes the item and, for a Folder, everything below it. */
export async function deleteItem(id: string) {
  await change((items) => {
    const doomed = subtreeIds(items, id);
    return items.filter((item) => !doomed.has(item.id));
  });
}

const itemStore: WorkerModule = {
  name: 'item-store',
  order: 10,
  start() {
    registerCommand('item/rename', ({ itemId, title }) => renameItem(itemId, title));
    registerCommand('item/delete', ({ itemId }) => deleteItem(itemId));
    registerCommand('item/favorite', ({ itemId }) => makeFavorite(itemId));

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && STORAGE_KEY in changes) notifySidebarChanged();
    });
  },
};
export default itemStore;
