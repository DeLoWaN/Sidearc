/**
 * Messages between the service worker and its views.
 * Each ticket edits only the types of its own section, so merges stay clean.
 * A section that no ticket has filled yet is `never`.
 */
import type { Settings, SidebarState } from './types';

export const PANEL_PORT = 'sidearc-panel';

// --- commands: sent by the panel on its port

/** Does nothing. Tests use it as a command that needs no ticket. */
export type MiscCommand = { type: 'noop' };

// tabs (#3, #7, #9, #10)
export type TabsCommand =
  /** Shows the tab. The worker focuses its window when it is not the window of the panel. */
  | { type: 'tab/activate'; tabId: number }
  | { type: 'tab/close'; tabId: number }
  /** Puts the tab at this position of the tab strip of its own window. */
  | { type: 'tab/move'; tabId: number; index: number }
  /** Closes every Unpinned Tab and puts it in View Archive. A window left empty gets a blank tab. */
  | { type: 'tab/clear' };

// items (#4, #5, #6)
export type ItemsCommand =
  /** Opens the live tab of the item, or shows it when it is open. Never makes a second tab. */
  | { type: 'item/open'; itemId: string }
  /** Sends the live tab of the item back to the saved URL. Does nothing at rest. */
  | { type: 'item/reset'; itemId: string }
  /** Does nothing when the title is blank. */
  | { type: 'item/rename'; itemId: string; title: string }
  /** Deletes the item. Its live tab stays open and becomes an Unpinned Tab. */
  | { type: 'item/delete'; itemId: string };

// folders (#4, #5)
export type FoldersCommand =
  /** Makes an open Folder at the end of the parent. Does nothing when the title is blank or the parent is not a Folder. */
  | { type: 'folder/create'; title: string; parentId: string | null }
  /** Collapses an open Folder, or opens a collapsed one. The state is saved. */
  | { type: 'folder/toggle'; itemId: string }
  /**
   * Puts a Pinned Tab or a Folder at the end of a Folder, or at the root when `parentId` is null.
   * Does nothing when the target is not a Folder, or is the item itself or inside it.
   * A Pinned Tab keeps its live tab. A Favorite becomes a Pinned Tab at that place and keeps its live tab.
   */
  | { type: 'item/move'; itemId: string; parentId: string | null };

// favorites (#6)
export type FavoritesCommand =
  /**
   * Turns a Pinned Tab into a Favorite, after the other Favorites. It keeps its live tab.
   * Does nothing for a Folder or a Favorite. Sends a notice and changes nothing when 12 Favorites exist.
   */
  { type: 'item/favorite'; itemId: string };

// tab groups (#9)
export type GroupsCommand =
  /** Collapses an expanded Tab group, or expands a collapsed one, in the tab strip too. */
  | { type: 'group/toggle'; groupId: number }
  /** Puts the tab at the end of the Tab group. The tab changes window when the group is in another one. */
  | { type: 'group/add-tab'; tabId: number; groupId: number }
  | { type: 'group/remove-tab'; tabId: number };

// archive (#8, #10)
export type ArchiveCommand =
  /** Opens the archived tab in the window of the panel, and removes its entry. */
  { type: 'archive/reopen'; entryId: string };

// drag and drop (#11)
export type DragCommand = never;

// search (#13)
export type SearchCommand = never;

// settings (#14)
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
  | SearchCommand
  | SettingsCommand
);

export type CommandType = Command['type'];

/** A message sent by the worker on a panel port. */
export type PortMessage =
  | { type: 'state'; state: SidebarState }
  /** A short text for the user, sent to the one panel whose command the worker refused. */
  | { type: 'notice'; message: string };

// --- rpc: one-off requests from the options page and the link guard, sent with runtime.sendMessage

/** Answers with the request. A view uses it to check that the worker is alive. */
export interface MiscRpc {
  'worker/ping': { request: string; response: string };
}

// link guard (#12)
export interface LinkGuardRpc {
  /** Asks whether the sending tab is the live tab of an item. */
  'link-guard/is-live': { request: null; response: boolean };
  /** Opens the web link in a new Unpinned Tab, next to the sending tab. Answers false for another link. */
  'link-guard/open': { request: { url: string }; response: boolean };
}

/** Sent by the worker to the top frame of a tab each time the live tabs change. */
export type LinkGuardPush = { type: 'link-guard/live'; live: boolean };

// settings (#14)
export type SaveSettingsResult = { ok: true; settings: Settings } | { ok: false; error: string };

export interface SettingsRpc {
  'settings/get': { request: null; response: Settings };
  /**
   * Saves the given settings and keeps the others. Saves nothing when one value is not valid.
   * The error names the setting and the wrong value.
   */
  'settings/save': { request: Partial<Settings>; response: SaveSettingsResult };
}

// backup (#15)
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

// Arc import (#16)
export type ArcImportRpc = unknown;

/** Maps the name of a request to its request type and its response type. */
export type RpcMap = MiscRpc & LinkGuardRpc & SettingsRpc & BackupRpc & ArcImportRpc;

export type RpcName = keyof RpcMap;
export type RpcMessage<K extends RpcName = RpcName> = { rpc: K; request: RpcMap[K]['request'] };
