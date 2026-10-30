import type { Command, CommandType } from '../../shared/protocol';
import type { ItemRecord } from '../../shared/types';
import { createQueue } from '../queue';
import { registerCommand, wrapCommands } from '../registry';
import { notifyOnStorageChange, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';
import { getItems, replaceItems } from './item-store';
import { getLiveTabs, readLiveLinks, restoreLiveTabs } from './live-tab-registry';
import { relinkOpenTabs } from './relink';
import { addTabToGroup } from './tab-groups';

export const UNDO_STORAGE_KEY = 'undoStack';

/** The Undo list holds this many actions. A new action pushes the oldest one out. */
export const UNDO_LIMIT = 20;

/** A change of the items, with the items and the live tab links from before it. */
interface ItemsEntry {
  kind: 'items';
  label: string;
  items: ItemRecord[];
  links: Record<string, number>;
}

/** The close of an Unpinned Tab, with what the tab was. */
interface TabEntry {
  kind: 'tab';
  label: string;
  url: string;
  windowId: number;
  index: number;
  /** The Tab group of the tab, or null when it had none. */
  groupId: number | null;
}

type Entry = ItemsEntry | TabEntry;

// Session storage keeps the list when the worker stops, and drops it when Chrome quits.
async function readStack(): Promise<Entry[]> {
  const stored = await browser.storage.session.get(UNDO_STORAGE_KEY);
  return (stored[UNDO_STORAGE_KEY] as Entry[] | undefined) ?? [];
}

const writeStack = (stack: Entry[]) => browser.storage.session.set({ [UNDO_STORAGE_KEY]: stack });

// A snapshot, its command and its push must not mix with another command or with an undo.
const turns = createQueue();

const quote = (title: string) => `"${title}"`;

/** The commands that change the items and can be undone, with the verb of their label. */
const ITEM_VERBS: Partial<Record<CommandType, string>> = {
  'item/delete': 'Delete',
  'item/move': 'Move',
  'item/rename': 'Rename',
  'item/favorite': 'Favorite',
  'item/unpin': 'Unpin',
  'item/from-tab': 'Pin',
  'folder/create': 'Create folder',
};

/** The title that the label quotes: the item as it was before the command, the new Folder, or the tab. */
async function titleBefore(command: Command, items: ItemRecord[]): Promise<string> {
  if (command.type === 'folder/create') return command.title.trim();
  if (command.type === 'item/from-tab') {
    const tab = await browser.tabs.get(command.tabId).catch(() => undefined);
    return tab?.title || tab?.url || '';
  }
  const itemId = 'itemId' in command ? command.itemId : undefined;
  return items.find((item) => item.id === itemId)?.title ?? '';
}

/** Takes the snapshot, runs the command, and returns the entry when the command changed the items. */
async function recordItemCommand(
  command: Command,
  verb: string,
  run: () => Promise<void>,
): Promise<Entry | undefined> {
  const [items, links] = await Promise.all([getItems(), readLiveLinks()]);
  const title = await titleBefore(command, items);
  await run();
  if (JSON.stringify(await getItems()) === JSON.stringify(items)) return undefined;
  return { kind: 'items', label: `${verb} ${quote(title)}`, items, links };
}

/** Takes the snapshot of an Unpinned Tab, runs the close, and returns the entry when the tab is gone. */
async function recordTabClose(tabId: number, run: () => Promise<void>): Promise<Entry | undefined> {
  const [tab, live] = await Promise.all([
    browser.tabs.get(tabId).catch(() => undefined),
    getLiveTabs(),
  ]);
  const url = tab?.url || tab?.pendingUrl;
  await run();
  if (!tab || !url || [...live.values()].includes(tabId)) return undefined;
  if (await exists(browser.tabs.get(tabId))) return undefined;
  return {
    kind: 'tab',
    label: `Close tab ${quote(tab.title || url)}`,
    url,
    windowId: tab.windowId,
    index: tab.index,
    groupId: tab.groupId > -1 ? tab.groupId : null,
  };
}

const exists = (lookup: Promise<unknown>) =>
  lookup.then(
    () => true,
    () => false,
  );

async function pushEntry(entry: Entry) {
  await writeStack([...(await readStack()), entry].slice(-UNDO_LIMIT));
}

async function undoable(command: Command, run: () => Promise<void>) {
  const verb = ITEM_VERBS[command.type];
  let entry: Entry | undefined;
  if (command.type === 'tab/close') entry = await recordTabClose(command.tabId, run);
  else if (verb) entry = await recordItemCommand(command, verb, run);
  else return run();
  if (entry) await pushEntry(entry);
}

/**
 * Runs a change of the items that no command makes, and adds it to the Undo list under the label.
 * Adds nothing when `run` throws.
 */
export function undoableItemsChange(label: string, run: () => Promise<void>): Promise<void> {
  return turns.run(async () => {
    const [items, links] = await Promise.all([getItems(), readLiveLinks()]);
    await run();
    await pushEntry({ kind: 'items', label, items, links });
  });
}

async function reopenTab(entry: TabEntry, panelWindowId: number) {
  const windowId = (await exists(browser.windows.get(entry.windowId)))
    ? entry.windowId
    : panelWindowId;
  const tab = await browser.tabs.create({
    windowId,
    url: entry.url,
    index: entry.index,
    active: false,
  });
  if (entry.groupId === null || windowId !== entry.windowId) return;
  const group = await browser.tabGroups.get(entry.groupId).catch(() => undefined);
  if (group?.windowId !== windowId) return;
  await addTabToGroup(tab.id as number, entry.groupId);
  // Joining a group moves the tab to the end of the group.
  await browser.tabs.move(tab.id as number, { index: entry.index });
}

async function restoreItems(entry: ItemsEntry) {
  await replaceItems(entry.items);
  await restoreLiveTabs(entry.links);
  await relinkOpenTabs();
}

const undoModule: WorkerModule = {
  name: 'undo',
  order: 15,
  start() {
    wrapCommands((command, run) => {
      if (command.type === 'undo') return run();
      return turns.run(() => undoable(command, run));
    });

    registerCommand('undo', ({ windowId }) =>
      turns.run(async () => {
        const stack = await readStack();
        const entry = stack.pop();
        if (!entry) return;
        // The entry leaves the list first, so an entry that fails never blocks the ones below it.
        await writeStack(stack);
        if (entry.kind === 'items') await restoreItems(entry);
        else await reopenTab(entry, windowId);
      }),
    );

    registerSidebarSection('undo', async () => {
      const newest = (await readStack()).at(-1);
      return { undo: newest ? { label: newest.label } : null };
    });
    notifyOnStorageChange('session', UNDO_STORAGE_KEY);
  },
};
export default undoModule;
