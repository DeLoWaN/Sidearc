import type { ItemKind, ItemRecord } from '../../shared/types';
import { endPosition, isFolderOrRoot, subtreeIds } from '../item-tree';
import { createQueue } from '../queue';
import { registerCommand } from '../registry';
import { notifySidebarChanged } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';

const STORAGE_KEY = 'items';

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
 * Throws, and adds nothing, when the parent is not a Folder.
 */
export async function addItem(input: {
  kind: ItemKind;
  title: string;
  url: string;
  parentId?: string | null;
}): Promise<ItemRecord> {
  const parentId = input.parentId ?? null;
  let added: ItemRecord | undefined;
  await change((items) => {
    if (!isFolderOrRoot(items, parentId)) throw new Error(`Not a Folder: ${parentId}`);
    added = {
      id: crypto.randomUUID(),
      kind: input.kind,
      title: input.title,
      url: input.url,
      parentId,
      position: endPosition(items, parentId),
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
 * Does nothing when the target is not a Folder, is the item itself or lies below it.
 */
export async function moveItem(id: string, parentId: string | null) {
  await change((items) => {
    const moved = items.find((item) => item.id === id);
    if (!moved || moved.parentId === parentId || !isFolderOrRoot(items, parentId)) return items;
    if (parentId !== null && subtreeIds(items, id).has(parentId)) return items;
    const position = endPosition(items, parentId);
    return items.map((item) => (item.id === id ? { ...item, parentId, position } : item));
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

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && STORAGE_KEY in changes) notifySidebarChanged();
    });
  },
};
export default itemStore;
