import {
  endPosition,
  isFolderOrRoot,
  MAX_FAVORITES,
  subtreeIds,
  topLevelIds,
} from '../../shared/item-tree';
import type { ItemKind, ItemRecord } from '../../shared/types';
import { createQueue } from '../queue';
import { registerCommand } from '../registry';
import { notifyOnStorageChange } from '../sidebar-hub';
import { UserError } from '../user-error';
import type { WorkerModule } from '../worker-module';

export const ITEMS_STORAGE_KEY = 'items';

/** The profile has 12 Favorites already. */
export class FavoriteLimitError extends UserError {
  constructor() {
    super(`Sidesweep keeps ${MAX_FAVORITES} Favorites at most. Remove one first.`);
  }
}

/** The target parent is not a Folder. Only a bug in the caller causes it, so the user never sees it. */
export class NotAFolderError extends Error {
  constructor(parentId: string | null) {
    super(`Not a Folder: ${parentId}`);
    this.name = 'NotAFolderError';
  }
}

const countFavorites = (items: ItemRecord[]) =>
  items.filter((item) => item.kind === 'favorite').length;

// Two writes in a row would both read the old list. The queue makes them take turns.
const writes = createQueue();

async function readItems(): Promise<ItemRecord[]> {
  const stored = await browser.storage.local.get(ITEMS_STORAGE_KEY);
  return (stored[ITEMS_STORAGE_KEY] as ItemRecord[] | undefined) ?? [];
}

/** Every item, ordered by position. */
export async function getItems(): Promise<ItemRecord[]> {
  const items = await readItems();
  return items.sort((a, b) => a.position - b.position);
}

async function change(update: (items: ItemRecord[]) => ItemRecord[]) {
  await writes.run(async () => {
    await browser.storage.local.set({ [ITEMS_STORAGE_KEY]: update(await readItems()) });
  });
}

/**
 * Adds an item at the index among the items of its parent, or at the end. Returns it with the id that Sidesweep made.
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
    if (!isFolderOrRoot(items, parentId)) throw new NotAFolderError(parentId);
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
    return input.index === undefined ? all : place(all, [added.id], {}, input.index);
  });
  return added as ItemRecord;
}

/** Replaces every item with the given list. */
export async function replaceItems(items: ItemRecord[]) {
  await change(() => items);
}

/** Gives the item a new title. Ignores a blank title and an unknown item. */
async function renameItem(id: string, title: string) {
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
 * Puts the items in one list at an index, in the given order, and renumbers the lists they leave and the list they enter.
 * The index counts the items of the target list without the moved items. It is clamped to the list.
 * `target` sets the fields that change on every moved item.
 */
function place(items: ItemRecord[], ids: string[], target: Partial<ItemRecord>, index?: number) {
  const moving = new Set(ids);
  const before = ids.map((id) => items.find((item) => item.id === id) as ItemRecord);
  const placed = before.map((item) => ({ ...item, ...target }));
  const list = listOf(placed[0] as ItemRecord);
  const entered = items
    .filter((item) => !moving.has(item.id) && listOf(item) === list)
    .sort((a, b) => a.position - b.position);
  const at = Math.min(Math.max(index ?? entered.length, 0), entered.length);
  const ordered = [...entered.slice(0, at), ...placed, ...entered.slice(at)];
  const rank = new Map(ordered.map((item, i) => [item.id, i]));
  const placedById = new Map(placed.map((item) => [item.id, item]));
  const result = items.map((item) =>
    rank.has(item.id)
      ? { ...(placedById.get(item.id) ?? item), position: rank.get(item.id) }
      : item,
  ) as ItemRecord[];
  const left = new Set(before.map(listOf));
  left.delete(list);
  return [...left].reduce(renumber, result);
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
    return place(items, [id], { kind: wasFavorite ? 'pinned' : moved.kind, parentId }, index);
  });
}

/**
 * Puts Pinned Tabs and Folders in one Folder, or at the root when `parentId` is null, at the index or at the end.
 * The items keep the given order. The index counts the items of the target without the moved items.
 * An item below another item of the list moves with it. Ignores unknown ids and Favorites.
 * Does nothing when the target is not a Folder, or is one of the items or lies below one of them.
 */
export async function moveItems(ids: string[], parentId: string | null, index?: number) {
  await change((items) => {
    const kindOf = new Map(items.map((item) => [item.id, item.kind]));
    const moving = topLevelIds(
      items,
      ids.filter((id) => kindOf.get(id) !== 'favorite'),
    );
    if (moving.length === 0 || !isFolderOrRoot(items, parentId)) return items;
    if (parentId !== null && moving.some((id) => subtreeIds(items, id).has(parentId))) return items;
    return place(items, moving, { parentId }, index);
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
      return index === undefined ? items : place(items, [id], {}, index);
    }
    if (moved?.kind !== 'pinned') return items;
    if (countFavorites(items) >= MAX_FAVORITES) throw new FavoriteLimitError();
    return place(items, [id], { kind: 'favorite', parentId: null }, index);
  });
}

/** Deletes the item and, for a Folder, everything below it. */
export async function deleteItem(id: string) {
  await deleteItems([id]);
}

/** Deletes the items and, for each Folder, everything below it. Ignores unknown ids. */
export async function deleteItems(ids: string[]) {
  await change((items) => {
    const doomed = new Set(ids.flatMap((id) => [...subtreeIds(items, id)]));
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

    notifyOnStorageChange('local', ITEMS_STORAGE_KEY);
  },
};
export default itemStore;
