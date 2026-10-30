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
export type TabsCommand = never;

// items (#4, #5, #6)
export type ItemsCommand = never;

// folders (#4, #5)
export type FoldersCommand = never;

// favorites (#6)
export type FavoritesCommand = never;

// tab groups (#9)
export type GroupsCommand = never;

// archive (#8, #10)
export type ArchiveCommand = never;

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
