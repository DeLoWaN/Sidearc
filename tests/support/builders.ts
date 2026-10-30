import type { SidebarState, TabView } from '../../src/shared/types';

let nextTabId = 1;

/** An Unpinned Tab with a new id. Give the fields that the test looks at. */
export function makeTab(overrides: Partial<TabView> = {}): TabView {
  const id = nextTabId++;
  return {
    id,
    windowId: 1,
    index: id - 1,
    title: `Tab ${id}`,
    url: `https://site-${id}.test/`,
    iconUrl: `https://site-${id}.test/icon.png`,
    active: false,
    ...overrides,
  };
}

/**
 * A complete sidebar state. A ticket that adds a required field to SidebarState adds its default
 * on a line of its own below, so older tests keep compiling.
 */
export function makeState(overrides: Partial<SidebarState> = {}): SidebarState {
  return {
    // tabs (#3)
    unpinnedTabs: [],

    // items (#4, #5, #6)

    // tab groups (#9)
    tabGroups: [],

    // settings (#14)

    ...overrides,
  };
}
