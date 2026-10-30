/**
 * Messages between the service worker and its views.
 */
import type { ArcImportResult } from './arc-import';
import type { Settings, SidebarState } from './types';

export const PANEL_PORT = 'sidearc-panel';

// --- commands: sent by the panel on its port

/** Does nothing. Tests use it as a command that needs no ticket. */
export type MiscCommand = { type: 'noop' };

// tabs
export type TabsCommand =
  /** Shows the tab. A tab of another window moves into the window of the panel (Tab Handoff). */
  | { type: 'tab/activate'; tabId: number }
  | { type: 'tab/close'; tabId: number }
  /**
   * Puts the tab at this position of the tab strip of its own window.
   * `groupId` puts the tab in that Tab group first, and `null` takes it out of its group first. Without it the group stays.
   */
  | { type: 'tab/move'; tabId: number; index: number; groupId?: number | null }
  /** Closes every Unpinned Tab and puts it in View Archive. A window left empty gets a blank tab. */
  | { type: 'tab/clear' };

// items
export type ItemsCommand =
  /** Opens the live tab of the item, or shows it when it is open. Never makes a second tab. */
  | { type: 'item/open'; itemId: string }
  /** Sends the live tab of the item back to the saved URL. Does nothing at rest. */
  | { type: 'item/reset'; itemId: string }
  /** Does nothing when the title is blank. */
  | { type: 'item/rename'; itemId: string; title: string }
  /** Deletes the item. Its live tab stays open and becomes an Unpinned Tab. */
  | { type: 'item/delete'; itemId: string };

// folders
export type FoldersCommand =
  /** Makes an open Folder at the end of the parent. Does nothing when the title is blank or the parent is not a Folder. */
  | { type: 'folder/create'; title: string; parentId: string | null }
  /** Collapses an open Folder, or opens a collapsed one. The state is saved. */
  | { type: 'folder/toggle'; itemId: string }
  /**
   * Puts a Pinned Tab or a Folder in a Folder, or at the root when `parentId` is null.
   * The item goes to `index` among the items of the target, counted without the item, or to the end without an index.
   * The positions of the list that the item leaves and of the list that it enters are renumbered.
   * Does nothing when the target is not a Folder, or is the item itself or inside it.
   * A Pinned Tab keeps its live tab. A Favorite becomes a Pinned Tab at that place and keeps its live tab.
   */
  | { type: 'item/move'; itemId: string; parentId: string | null; index?: number };

// favorites
export type FavoritesCommand =
  /**
   * Turns a Pinned Tab into a Favorite at `index` among the Favorites, or after them without an index. It keeps its live tab.
   * A Favorite moves to `index` among the Favorites, and stays put without an index.
   * Does nothing for a Folder. Sends a notice and changes nothing when 12 Favorites exist and the item is not one of them.
   */
  { type: 'item/favorite'; itemId: string; index?: number };

// tab groups
export type GroupsCommand =
  /** Collapses an expanded Tab group, or expands a collapsed one, in the tab strip too. */
  | { type: 'group/toggle'; groupId: number }
  /** Puts the tab at the end of the Tab group. The tab changes window when the group is in another one. */
  | { type: 'group/add-tab'; tabId: number; groupId: number }
  | { type: 'group/remove-tab'; tabId: number };

// archive
export type ArchiveCommand =
  /** Opens the archived tab in the window of the panel, and removes its entry. */
  { type: 'archive/reopen'; entryId: string };

// drag and drop
export type DragCommand =
  /**
   * Saves an Unpinned Tab as a Pinned Tab or a Favorite with its URL and title, and the tab becomes its live tab.
   * The item goes to `index` among the items of the parent, or to the end. A Favorite has no parent.
   * Does nothing when the tab already has an item or the parent is not a Folder.
   * Sends a notice and changes nothing for a 13th Favorite.
   */
  | {
      type: 'item/from-tab';
      tabId: number;
      kind: 'pinned' | 'favorite';
      parentId: string | null;
      index?: number;
    }
  /**
   * Deletes a Pinned Tab or a Favorite and keeps it as an Unpinned Tab: its live tab stays open.
   * An item at rest opens its saved URL in a new tab in the window of the panel. Does nothing for a Folder.
   */
  | { type: 'item/unpin'; itemId: string };

// settings
export type SettingsCommand =
  /** Opens the options page: a new tab, or the tab that already shows it. */
  { type: 'options/open' };

/** A command sent by the panel on its port. Every command carries the id of the sending window. */
export type Command = { windowId: number } & (
  | MiscCommand
  | TabsCommand
  | ItemsCommand
  | FoldersCommand
  | FavoritesCommand
  | GroupsCommand
  | ArchiveCommand
  | DragCommand
  | SettingsCommand
);

export type CommandType = Command['type'];

/** A message sent by the worker on a panel port. */
export type PortMessage =
  | { type: 'state'; state: SidebarState }
  /** A short text for the user, sent to the one panel whose command the worker refused. */
  | { type: 'notice'; message: string };

// --- rpc: one-off requests, sent with runtime.sendMessage

/** Answers with the request. A view uses it to check that the worker is alive. */
export interface MiscRpc {
  'worker/ping': { request: string; response: string };
}

// link guard
export interface LinkGuardRpc {
  /** Asks whether the sending tab is the live tab of an item. */
  'link-guard/is-live': { request: null; response: boolean };
  /** Opens the web link in a new Unpinned Tab, next to the sending tab. Answers false for another link. */
  'link-guard/open': { request: { url: string }; response: boolean };
}

/** Sent by the worker to the top frame of a tab each time the live tabs change. */
export type LinkGuardPush = { type: 'link-guard/live'; live: boolean };

// settings
export type SaveSettingsResult = { ok: true; settings: Settings } | { ok: false; error: string };

export interface SettingsRpc {
  'settings/get': { request: null; response: Settings };
  /**
   * Saves the given settings and keeps the others. Saves nothing when one value is not valid.
   * The error names the setting and the wrong value.
   */
  'settings/save': { request: Partial<Settings>; response: SaveSettingsResult };
}

// backup
/** The number of items of each kind in a backup, and its archived tabs. */
export interface BackupSummary {
  favorites: number;
  pinnedTabs: number;
  folders: number;
  archivedTabs: number;
}

export type BackupCheckResult = { ok: true; summary: BackupSummary } | { ok: false; error: string };

export interface BackupRpc {
  /** Answers with the text of a backup file that holds all the data of Sidearc. */
  'backup/export': { request: null; response: string };
  /** Checks the text of a backup file and counts its content. Changes nothing. */
  'backup/inspect': { request: string; response: BackupCheckResult };
  /** Checks the text, then replaces all the data with its content. A refused text changes nothing. */
  'backup/import': { request: string; response: BackupCheckResult };
}

// Arc import
export interface ArcImportRpc {
  /** True while Sidearc has no item, the one case where the import runs. */
  'arc-import/available': { request: null; response: boolean };
  /**
   * Imports one space of the Arc file, all items at once. The text is the content of `StorableSidebar.json`.
   * Changes nothing and gives the reason when the file is refused or Sidearc has items.
   */
  'arc-import/run': { request: { text: string; spaceId: string }; response: ArcImportResult };
}

/** Maps the name of a request to its request type and its response type. */
export type RpcMap = MiscRpc & LinkGuardRpc & SettingsRpc & BackupRpc & ArcImportRpc;

export type RpcName = keyof RpcMap;
export type RpcMessage<K extends RpcName = RpcName> = { rpc: K; request: RpcMap[K]['request'] };
