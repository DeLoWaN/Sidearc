import type { SiteGroupView } from '../../shared/types';
import { siteOf } from '../../shared/url';
import { createQueue } from '../queue';
import { registerCommand } from '../registry';
import { notifyOnStorageChange, registerSidebarSection } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';
import { getLiveTabs, LIVE_TABS_STORAGE_KEY } from './live-tab-registry';
import { getSettings } from './settings';

export const SITE_GROUPS_STORAGE_KEY = 'siteGroups';

const MAX_GROUP_NAME_LENGTH = 60;

/** The name without surrounding spaces, cut to the limit by characters, so no emoji breaks. Empty means no name. */
const cleanName = (name: string) =>
  Array.from(name.trim()).slice(0, MAX_GROUP_NAME_LENGTH).join('').trim();

interface StoredGroup {
  id: string;
  host: string;
  /** The custom name. Absent when the user gave none. */
  name?: string;
  tabIds: number[];
  collapsed: boolean;
}

interface Stored {
  groups: StoredGroup[];
  /** Tabs that opened from another tab and have no web address yet. */
  pending: number[];
}

const NO_GROUP = -1; // chrome.tabGroups.TAB_GROUP_ID_NONE

const writes = createQueue();

async function read(): Promise<Stored> {
  const stored = await browser.storage.session.get(SITE_GROUPS_STORAGE_KEY);
  return (stored[SITE_GROUPS_STORAGE_KEY] as Stored | undefined) ?? { groups: [], pending: [] };
}

function change(update: (stored: Stored) => Stored | Promise<Stored>) {
  return writes
    .run(async () => {
      const before = await read();
      const after = await update(before);
      // Most tab events change nothing: skip the write, which would wake every panel.
      if (JSON.stringify(after) !== JSON.stringify(before))
        await browser.storage.session.set({ [SITE_GROUPS_STORAGE_KEY]: after });
    })
    .catch(console.error);
}

/** Open Unpinned Tabs that are in no Tab group, by id. */
async function eligibleTabs(): Promise<Map<number, chrome.tabs.Tab>> {
  const [tabs, live] = await Promise.all([browser.tabs.query({}), getLiveTabs()]);
  const liveIds = new Set(live.values());
  return new Map(
    tabs
      .filter((tab) => !liveIds.has(tab.id as number) && (tab.groupId ?? NO_GROUP) === NO_GROUP)
      .map((tab) => [tab.id as number, tab]),
  );
}

/** Keeps the member tabs that still qualify, and the groups that keep 2 tabs. */
function pruned(stored: Stored, eligible: Map<number, chrome.tabs.Tab>): Stored {
  const groups = stored.groups
    .map((group) => ({ ...group, tabIds: group.tabIds.filter((id) => eligible.has(id)) }))
    .filter((group) => group.tabIds.length >= 2);
  return { groups, pending: stored.pending.filter((id) => eligible.has(id)) };
}

const forgetGone = () => change(async (stored) => pruned(stored, await eligibleTabs()));

const withoutTab = (groups: StoredGroup[], tabId: number) =>
  groups
    .map((group) => ({ ...group, tabIds: group.tabIds.filter((id) => id !== tabId) }))
    .filter((group) => group.tabIds.length >= 2);

/** Puts a tab that opened from another tab in a group, once its site is known and equals the site of its opener. */
async function join(stored: Stored, tabId: number): Promise<Stored> {
  if (!stored.pending.includes(tabId)) return stored;
  const eligible = await eligibleTabs();
  const tab = eligible.get(tabId);
  if (!tab) return pruned(stored, eligible);
  const address = tab.url || tab.pendingUrl || '';
  if (address === '' || address === 'about:blank') return stored; // The tab stays pending until it has an address.

  const settled = { ...stored, pending: stored.pending.filter((id) => id !== tabId) };
  const opener = tab.openerTabId === undefined ? undefined : eligible.get(tab.openerTabId);
  const site = siteOf(address);
  if (!site || !opener || !(await getSettings()).groupBySite) return settled;
  if (siteOf(opener.url || opener.pendingUrl || '') !== site) return settled;

  const openerId = opener.id as number;
  const existing = settled.groups.find((group) => group.tabIds.includes(openerId));
  if (existing) {
    return {
      ...settled,
      groups: settled.groups.map((group) =>
        group === existing ? { ...group, tabIds: [...group.tabIds, tabId] } : group,
      ),
    };
  }
  const created = {
    id: crypto.randomUUID(),
    host: site,
    tabIds: [openerId, tabId],
    collapsed: false,
  };
  return { ...settled, groups: [...settled.groups, created] };
}

/** The groups as the panel shows them: members that still qualify, in tab strip order. */
async function composeSiteGroups(): Promise<SiteGroupView[]> {
  const [stored, eligible] = await Promise.all([read(), eligibleTabs()]);
  const position = (tabId: number) => {
    const tab = eligible.get(tabId) as chrome.tabs.Tab;
    return tab.windowId * 1_000_000 + tab.index;
  };
  return pruned(stored, eligible)
    .groups.map(({ id, host, name, tabIds, collapsed }) => ({
      id,
      host,
      name: name ?? null,
      tabIds: [...tabIds].sort((a, b) => position(a) - position(b)),
      collapsed,
    }))
    .sort((a, b) => position(a.tabIds[0] as number) - position(b.tabIds[0] as number));
}

const siteGroups: WorkerModule = {
  name: 'site-groups',
  order: 22,
  start() {
    registerSidebarSection('site-groups', async () => ({ siteGroups: await composeSiteGroups() }));

    registerCommand('site-group/toggle', ({ groupId }) =>
      change((stored) => ({
        ...stored,
        groups: stored.groups.map((group) =>
          group.id === groupId ? { ...group, collapsed: !group.collapsed } : group,
        ),
      })),
    );

    registerCommand('site-group/rename', ({ groupId, name }) =>
      change((stored) => ({
        ...stored,
        groups: stored.groups.map((group) => {
          if (group.id !== groupId) return group;
          const { name: _old, ...rest } = group;
          const custom = cleanName(name);
          return custom ? { ...rest, name: custom } : rest;
        }),
      })),
    );

    registerCommand('site-group/ungroup', ({ groupId }) =>
      change((stored) => ({
        ...stored,
        groups: stored.groups.filter((group) => group.id !== groupId),
      })),
    );

    registerCommand('site-group/remove-tab', ({ tabId }) =>
      change((stored) => ({ ...stored, groups: withoutTab(stored.groups, tabId) })),
    );

    browser.tabs.onCreated.addListener((tab) => {
      if (tab.id === undefined || tab.openerTabId === undefined) return;
      const tabId = tab.id;
      change((stored) => join({ ...stored, pending: [...stored.pending, tabId] }, tabId));
    });

    browser.tabs.onUpdated.addListener((tabId, changes) => {
      if (changes.url) change((stored) => join(stored, tabId));
      // The tab left the Unpinned Tabs: it joined a Tab group or became a Pinned Tab in Chrome.
      if (changes.groupId !== undefined || changes.pinned !== undefined) forgetGone();
    });

    browser.tabs.onRemoved.addListener(() => forgetGone());

    // Chrome swaps a tab for another one, for example after a prerender. The member keeps its place.
    browser.tabs.onReplaced.addListener((added, removed) => {
      const swap = (id: number) => (id === removed ? added : id);
      change((stored) => ({
        groups: stored.groups.map((group) => ({ ...group, tabIds: group.tabIds.map(swap) })),
        pending: stored.pending.map(swap),
      }));
    });

    // A tab that becomes the live tab of a Pinned Tab or a Favorite leaves its group.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'session' && LIVE_TABS_STORAGE_KEY in changes) forgetGone();
    });

    notifyOnStorageChange('session', SITE_GROUPS_STORAGE_KEY);
  },
};
export default siteGroups;
