/**
 * Messages between the service worker and its views.
 * Each ticket edits only the types of its own section, so merges stay clean.
 * A section that no ticket has filled yet is `never`.
 */
import type { SidebarState } from './types';

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
export type FoldersCommand = never;

// favorites (#6)
export type FavoritesCommand = never;

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
export type SettingsCommand = never;

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
export type PortMessage = { type: 'state'; state: SidebarState };

// --- rpc: one-off requests from the options page and the link guard, sent with runtime.sendMessage

/** Answers with the request. A view uses it to check that the worker is alive. */
export interface MiscRpc {
  'worker/ping': { request: string; response: string };
}

// link guard (#12)
export type LinkGuardRpc = unknown;

// settings (#14)
export type SettingsRpc = unknown;

// backup (#15)
export type BackupRpc = unknown;

// Arc import (#16)
export type ArcImportRpc = unknown;

/** Maps the name of a request to its request type and its response type. */
export type RpcMap = MiscRpc & LinkGuardRpc & SettingsRpc & BackupRpc & ArcImportRpc;

export type RpcName = keyof RpcMap;
export type RpcMessage<K extends RpcName = RpcName> = { rpc: K; request: RpcMap[K]['request'] };
