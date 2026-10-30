import type { ItemView, LiveTabView, SidebarState, TabView } from '../../src/shared/types';

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
    items: [],

    // tab groups (#9)

    // settings (#14)

    ...overrides,
  };
}

let nextItemId = 1;

/**
 * An item at rest with a new id. A `live` object makes it an item with an open live tab:
 * give only the fields that the test looks at.
 */
export function makeItem(
  overrides: Partial<Omit<ItemView, 'live'>> & { live?: Partial<LiveTabView> } = {},
): ItemView {
  const n = nextItemId++;
  const { live, ...fields } = overrides;
  const item: ItemView = {
    id: `item-${n}`,
    kind: 'pinned',
    title: `Item ${n}`,
    url: `https://item-${n}.test/`,
    parentId: null,
    position: n - 1,
    collapsed: false,
    iconUrl: `https://item-${n}.test/icon.png`,
    ...fields,
  };
  if (live) {
    item.live = {
      tabId: n,
      windowId: 1,
      title: item.title,
      active: false,
      away: false,
      ...live,
    };
  }
  return item;
}
