/**
 * Data types shared by the service worker and its views. Pure TypeScript: no browser API here.
 * Each ticket edits only the types of its own section, so merges stay clean.
 * A section that no ticket has filled yet is `unknown`, which adds nothing to the state.
 */

// tabs (#3)

/** One open Chrome tab, as the panel shows it. */
export interface TabView {
  id: number;
  windowId: number;
  /** Position in the tab strip of its window, from 0. */
  index: number;
  title: string;
  url: string;
  /** Address of an image the panel can show: the page icon, or the Chrome cache of site icons. */
  iconUrl: string;
  /** True for the tab on screen in its window. */
  active: boolean;
}

export type TabsState = {
  /** The Unpinned Tabs of all windows: windows by id, tabs in tab strip order. */
  unpinnedTabs: TabView[];
};

// items (#4, #5, #6)
export type ItemsState = unknown;

// tab groups (#9)
export type GroupsState = unknown;

// settings (#14)
export type SettingsState = unknown;

/** The full state the worker sends to the panel after every change. */
export type SidebarState = TabsState & ItemsState & GroupsState & SettingsState;
