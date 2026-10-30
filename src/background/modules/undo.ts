import { plural } from '../../shared/plural';
import type { Command, CommandType } from '../../shared/protocol';
import type { ItemRecord, SiteGroupView } from '../../shared/types';
import { createQueue } from '../queue';
import { registerCommand, wrapCommands } from '../registry';
import { notifyOnStorageChange, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';
import { getItems, replaceItems } from './item-store';
import { getLiveTabs, readLiveLinks, restoreLiveTabs } from './live-tab-registry';
import { relinkOpenTabs } from './relink';
import { selectedRoots, selectedTabs } from './selection';
import { restoreSiteGroup, shownSiteGroup } from './site-groups';
import { addTabToGroup, restoreTabGroup, shownTabGroup } from './tab-groups';

export const UNDO_STORAGE_KEY = 'undoStack';

/** The Undo list holds this many actions. A new action pushes the oldest one out. */
export const UNDO_LIMIT = 20;

/** An Unpinned Tab that a command closed: where Undo opens it again. */
interface ClosedTab {
  url: string;
  windowId: number;
  index: number;
}

/**
 * A change of the items, with the items and the live tab links from before it.
 * `tabs` holds the tabs that the same command closed, in tab strip order.
 */
interface ItemsEntry {
  kind: 'items';
  label: string;
  items: ItemRecord[];
  links: Record<string, number>;
  tabs?: ClosedTab[];
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

/** The Tab group or the site group that held the tabs of a closed group. */
type Regrouping =
  | { kind: 'tab-group'; original: chrome.tabGroups.TabGroup }
  | { kind: 'site-group'; original: Omit<SiteGroupView, 'id' | 'tabIds'> };

/** The close of a group: the tabs it closed, in tab strip order, and how to group them again. */
interface GroupEntry {
  kind: 'group';
  label: string;
  tabs: ClosedTab[];
  regrouping: Regrouping;
}

type Entry = ItemsEntry | TabEntry | GroupEntry;

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

type GroupCloseCommand = Extract<Command, { type: 'group/close' | 'site-group/close' }>;

/** The label, the tabs and the grouping of the group that the command closes. Undefined when the group does not exist. */
async function groupBefore(command: GroupCloseCommand) {
  if (command.type === 'group/close') {
    const shown = await shownTabGroup(command.groupId);
    if (!shown) return undefined;
    const { group, tabs } = shown;
    const regrouping: Regrouping = { kind: 'tab-group', original: group };
    return { name: group.title || group.color, tabs, regrouping };
  }
  const shown = await shownSiteGroup(command.groupId);
  if (!shown) return undefined;
  const { id: _id, tabIds: _tabIds, ...original } = shown.group;
  const regrouping: Regrouping = { kind: 'site-group', original };
  return { name: shown.group.name ?? shown.group.host, tabs: shown.tabs, regrouping };
}

/** Takes the snapshot of a group, runs the close, and returns the entry for the member tabs that are gone. */
async function recordGroupClose(
  command: GroupCloseCommand,
  run: () => Promise<void>,
): Promise<Entry | undefined> {
  const before = await groupBefore(command);
  await run();
  if (!before) return undefined;
  const gone: ClosedTab[] = [];
  for (const tab of before.tabs) {
    if (await exists(browser.tabs.get(tab.id as number))) continue;
    gone.push({
      url: tab.url || tab.pendingUrl || 'chrome://newtab/',
      windowId: tab.windowId,
      index: tab.index,
    });
  }
  if (gone.length === 0) return undefined;
  return {
    kind: 'group',
    label: `Close group ${quote(before.name)}`,
    tabs: gone,
    regrouping: before.regrouping,
  };
}

type SelectionCommand = Extract<Command, { type: 'selection/close' | 'selection/move' }>;

/** Takes the snapshot of the items and of the tabs, runs the close, and returns the entry for what is gone. */
async function recordSelectionClose(
  command: Extract<SelectionCommand, { type: 'selection/close' }>,
  run: () => Promise<void>,
): Promise<Entry | undefined> {
  const [items, links, tabs] = await Promise.all([
    getItems(),
    readLiveLinks(),
    selectedTabs(command.tabIds),
  ]);
  const roots = selectedRoots(items, command.itemIds);
  await run();
  const remaining = new Set((await getItems()).map((item) => item.id));
  const goneRoots = roots.filter((id) => !remaining.has(id));
  const goneTabs: ClosedTab[] = [];
  for (const tab of tabs) {
    if (await exists(browser.tabs.get(tab.id as number))) continue;
    goneTabs.push({
      url: tab.url || tab.pendingUrl || 'chrome://newtab/',
      windowId: tab.windowId,
      index: tab.index,
    });
  }
  const count = goneRoots.length + goneTabs.length;
  if (count === 0) return undefined;
  return {
    kind: 'items',
    label: `Close ${plural(count, 'item')}`,
    items,
    links,
    tabs: goneTabs,
  };
}

/** Takes the snapshot of the items, runs the move, and returns the entry when the items changed. */
async function recordSelectionMove(
  command: Extract<SelectionCommand, { type: 'selection/move' }>,
  run: () => Promise<void>,
): Promise<Entry | undefined> {
  const [items, links, tabs] = await Promise.all([
    getItems(),
    readLiveLinks(),
    selectedTabs(command.tabIds),
  ]);
  const count = selectedRoots(items, command.itemIds).length + tabs.length;
  await run();
  if (JSON.stringify(await getItems()) === JSON.stringify(items)) return undefined;
  return { kind: 'items', label: `Move ${plural(count, 'item')}`, items, links };
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
  else if (command.type === 'group/close' || command.type === 'site-group/close')
    entry = await recordGroupClose(command, run);
  else if (command.type === 'selection/close') entry = await recordSelectionClose(command, run);
  else if (command.type === 'selection/move') entry = await recordSelectionMove(command, run);
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

/** Opens the closed tabs again, not active, in their windows. A window that is gone sends its tabs to the panel window. */
async function reopenTabs(
  closedTabs: ClosedTab[],
  panelWindowId: number,
): Promise<chrome.tabs.Tab[]> {
  const windows = new Map<number, boolean>();
  const created: chrome.tabs.Tab[] = [];
  // Tabs come in tab strip order, so each one lands at its own index when the earlier ones are back.
  for (const closed of closedTabs) {
    if (!windows.has(closed.windowId))
      windows.set(closed.windowId, await exists(browser.windows.get(closed.windowId)));
    const sameWindow = windows.get(closed.windowId);
    created.push(
      await browser.tabs.create({
        windowId: sameWindow ? closed.windowId : panelWindowId,
        url: closed.url,
        // The index of a window that is gone means nothing in the window of the panel: the tab goes last.
        ...(sameWindow ? { index: closed.index } : {}),
        active: false,
      }),
    );
  }
  return created;
}

async function reopenGroup(entry: GroupEntry, panelWindowId: number) {
  const created = await reopenTabs(entry.tabs, panelWindowId);
  const tabIds = created.map((tab) => tab.id as number);
  const { regrouping } = entry;
  if (regrouping.kind === 'site-group') {
    await restoreSiteGroup(regrouping.original, tabIds);
  } else {
    await restoreTabGroup(
      tabIds as [number, ...number[]],
      (created[0] as chrome.tabs.Tab).windowId,
      regrouping.original,
    );
  }
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
        if (entry.kind === 'items') {
          await restoreItems(entry);
          if (entry.tabs) await reopenTabs(entry.tabs, windowId);
        } else if (entry.kind === 'group') await reopenGroup(entry, windowId);
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
