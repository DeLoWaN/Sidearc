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

/** What an item is. Ticket #6 adds 'favorite'. */
export type ItemKind = 'pinned' | 'folder';

/** One item as the worker stores it, in `chrome.storage.local`. */
export interface ItemRecord {
  /** Made by Sidearc. It never is a Chrome id. */
  id: string;
  kind: ItemKind;
  /** The title that the user sees at rest. The user can rename it. */
  title: string;
  /** The saved URL. Reset sends the live tab back to it. Empty for a Folder. */
  url: string;
  /** The Folder that holds the item, or null at the root. */
  parentId: string | null;
  /** Place among the items of the same parent, from 0. */
  position: number;
  collapsed: boolean;
}

/** The live tab of an item, as the panel shows it. */
export interface LiveTabView {
  tabId: number;
  windowId: number;
  /** The title of the page now, not the saved title. */
  title: string;
  /** True when the tab is on screen in its window. */
  active: boolean;
  /** True when the tab is not on the saved URL any more. */
  away: boolean;
}

/** One item, with the status of its live tab. */
export interface ItemView extends ItemRecord {
  iconUrl: string;
  /** Missing when the item is at rest. */
  live?: LiveTabView;
}

export type ItemsState = {
  /** Every item, in the order of its parent and its position. */
  items: ItemView[];
};

// tab groups (#9)

/** The colours of a Chrome Tab group. */
export type TabGroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange';

/** One Chrome Tab group, as the panel shows it. */
export interface TabGroupView {
  id: number;
  windowId: number;
  title: string;
  color: TabGroupColor;
  collapsed: boolean;
  /** The tabs of the group in tab strip order. A tab that the panel does not list is ignored. */
  tabIds: number[];
}

export type GroupsState = {
  /** The Tab groups of all windows in tab strip order: windows by id, groups by first tab. */
  tabGroups: TabGroupView[];
};

// settings (#14)
export type SettingsState = unknown;

/** The full state the worker sends to the panel after every change. */
export type SidebarState = TabsState & ItemsState & GroupsState & SettingsState;
