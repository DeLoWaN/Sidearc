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
 * Adds an item at the index among the items of its parent, or at the end. Returns it with the id that Sidearc made.
 * A Favorite has no parent and goes in the Favorites.
 * Throws, and adds nothing, when the parent is not a Folder, or when 12 Favorites exist.
 */
export async function addItem(input: {
  kind: ItemKind;
  title: string;
  url: string;
  parentId?: string | null;
  index?: number;
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
    const all = [...items, added];
    return input.index === undefined ? all : place(all, added.id, {}, input.index);
  });
  return added as ItemRecord;
}

/**
 * Stores the given items, which hold their own ids, parents and positions.
 * Stores nothing and returns false when Sidearc already has an item.
 */
export async function addItemsToEmptyStore(newItems: ItemRecord[]): Promise<boolean> {
  let stored = false;
  await change((items) => {
    stored = items.length === 0;
    return stored ? newItems : items;
  });
  return stored;
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

/** The list that holds the item: the Favorites, or the Pinned Tabs and Folders of one parent. */
const listOf = (item: ItemRecord) => (item.kind === 'favorite' ? 'favorites' : item.parentId);

/** Gives each item of the list its index as position. Items of other lists stay as they are. */
function renumber(items: ItemRecord[], list: string | null): ItemRecord[] {
  const ordered = items
    .filter((item) => listOf(item) === list)
    .sort((a, b) => a.position - b.position);
  return items.map((item) =>
    listOf(item) === list ? { ...item, position: ordered.indexOf(item) } : item,
  );
}

/**
 * Puts the item in a list at an index, and renumbers the list it leaves and the list it enters.
 * The index counts the items of the target list without the moved item. It is clamped to the list.
 */
function place(items: ItemRecord[], id: string, target: Partial<ItemRecord>, index?: number) {
  const moved = items.find((item) => item.id === id) as ItemRecord;
  const placed = { ...moved, ...target };
  const entered = items
    .filter((item) => item.id !== id && listOf(item) === listOf(placed))
    .sort((a, b) => a.position - b.position);
  const at = Math.min(Math.max(index ?? entered.length, 0), entered.length);
  const ordered = [...entered.slice(0, at), placed, ...entered.slice(at)];
  const rank = new Map(ordered.map((item, i) => [item.id, i]));
  const result = items.map((item) =>
    rank.has(item.id) ? { ...(item.id === id ? placed : item), position: rank.get(item.id) } : item,
  ) as ItemRecord[];
  return listOf(moved) === listOf(placed) ? result : renumber(result, listOf(moved));
}

/**
 * Puts the item in another Folder, or at the root when `parentId` is null, at the index or at the end.
 * The index counts the items of the target without the moved item.
 * A Favorite becomes a Pinned Tab at that place.
 * Does nothing when the target is not a Folder, is the item itself or lies below it.
 * Without an index, does nothing when the item is already in that parent.
 */
export async function moveItem(id: string, parentId: string | null, index?: number) {
  await change((items) => {
    const moved = items.find((item) => item.id === id);
    if (!moved || !isFolderOrRoot(items, parentId)) return items;
    const wasFavorite = moved.kind === 'favorite';
    if (!wasFavorite && moved.parentId === parentId && index === undefined) return items;
    if (parentId !== null && subtreeIds(items, id).has(parentId)) return items;
    return place(items, id, { kind: wasFavorite ? 'pinned' : moved.kind, parentId }, index);
  });
}

/**
 * Turns a Pinned Tab into a Favorite at the index, or at the end of the Favorites.
 * The item keeps its id, so its live tab stays.
 * A Favorite moves inside the Favorites when it gets an index, and stays put without one.
 * Ignores a Folder and an unknown item. Throws when a Pinned Tab would be the 13th Favorite.
 */
export async function makeFavorite(id: string, index?: number) {
  await change((items) => {
    const moved = items.find((item) => item.id === id);
    if (moved?.kind === 'favorite') {
      return index === undefined ? items : place(items, id, {}, index);
    }
    if (moved?.kind !== 'pinned') return items;
    if (countFavorites(items) >= MAX_FAVORITES) throw new FavoriteLimitError();
    return place(items, id, { kind: 'favorite', parentId: null }, index);
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
    registerCommand('item/favorite', ({ itemId, index }) => makeFavorite(itemId, index));

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && STORAGE_KEY in changes) notifySidebarChanged();
    });
  },
};
export default itemStore;
