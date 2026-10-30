import type { ItemKind, ItemRecord } from '../../shared/types';
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

/** Adds an item at the end of its parent. Returns it with the id that Sidearc made. */
export async function addItem(input: {
  kind: ItemKind;
  title: string;
  url: string;
  parentId?: string | null;
}): Promise<ItemRecord> {
  const parentId = input.parentId ?? null;
  let added: ItemRecord | undefined;
  await change((items) => {
    const siblings = items.filter((item) => item.parentId === parentId);
    added = {
      id: crypto.randomUUID(),
      kind: input.kind,
      title: input.title,
      url: input.url,
      parentId,
      position: Math.max(-1, ...siblings.map((item) => item.position)) + 1,
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

export async function deleteItem(id: string) {
  await change((items) => items.filter((item) => item.id !== id));
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
