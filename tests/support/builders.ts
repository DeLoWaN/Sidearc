import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import type {
  ArchiveEntry,
  ItemView,
  LiveTabView,
  SidebarState,
  TabView,
} from '../../src/shared/types';

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
    unvisited: false,
    ...overrides,
  };
}

/** A complete sidebar state. Each field has an empty default. */
export function makeState(overrides: Partial<SidebarState> = {}): SidebarState {
  return {
    // tabs
    unpinnedTabs: [],

    // items
    items: [],

    // tab groups
    tabGroups: [],

    // site groups
    siteGroups: [],

    // archive
    archive: [],

    // undo
    undo: null,

    // settings
    settings: DEFAULT_SETTINGS,

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
      url: item.url,
      active: false,
      away: false,
      ...live,
    };
  }
  return item;
}

let nextEntryId = 1;

/** An archived tab with a new id, closed just now. Give the fields that the test looks at. */
export function makeArchiveEntry(overrides: Partial<ArchiveEntry> = {}): ArchiveEntry {
  const n = nextEntryId++;
  return {
    id: `entry-${n}`,
    url: `https://archived-${n}.test/`,
    title: `Archived ${n}`,
    iconUrl: `https://archived-${n}.test/icon.png`,
    closedAt: Date.now(),
    ...overrides,
  };
}
