/**
 * Data types shared by the service worker and its views. Pure TypeScript: no browser API here.
 * Each ticket edits only the types of its own section, so merges stay clean.
 * A section that no ticket has filled yet is `unknown`, which adds nothing to the state.
 */

// tabs (#3)
export type TabsState = unknown;

// items (#4, #5, #6)
export type ItemsState = unknown;

// tab groups (#9)
export type GroupsState = unknown;

// settings (#14)
export type SettingsState = unknown;

/** The full state the worker sends to the panel after every change. */
export type SidebarState = TabsState & ItemsState & GroupsState & SettingsState;
