/**
 * In-memory fake of the Chrome APIs that @webext-core/fake-browser lacks or fakes poorly:
 * windows, tabs (incl. move, group), tabGroups and sidePanel.
 * Storage, alarms and runtime messaging stay on the stock fake browser.
 *
 *   beforeEach(() => fakeChrome.reset());   // call once per test
 *   const w = await fakeChrome.openWindow(['https://a.test/']);
 */
import { fakeBrowser } from 'wxt/testing/fake-browser';

type Fn = (...args: never[]) => unknown;

/** Chrome-like event: addListener/removeListener plus trigger() for tests. */
export class FakeEvent<F extends Fn = Fn> {
  private listeners = new Set<F>();
  addListener = (l: F) => void this.listeners.add(l);
  removeListener = (l: F) => void this.listeners.delete(l);
  hasListener = (l: F) => this.listeners.has(l);
  hasListeners = () => this.listeners.size > 0;
  clear() {
    this.listeners.clear();
  }
  /** Calls every listener with the given arguments and waits for them. */
  async trigger(...args: Parameters<F>) {
    await Promise.all(
      [...this.listeners].map((l) => (l as unknown as (...a: unknown[]) => unknown)(...args)),
    );
  }
}

type Tab = chrome.tabs.Tab;
type Group = chrome.tabGroups.TabGroup;
type Win = { id: number; focused: boolean };

const NONE = -1; // chrome.tabs.TAB_GROUP_ID_NONE and chrome.windows.WINDOW_ID_NONE

class FakeChrome {
  private wins: Win[] = [];
  private tabList: Tab[] = [];
  private groupList: Group[] = [];
  private nextTabId = 1;
  private nextWindowId = 1;
  private nextGroupId = 1;
  private lastFocusedId: number | undefined;

  readonly events = {
    tabs: {
      onCreated: new FakeEvent<(tab: Tab) => void>(),
      onRemoved: new FakeEvent<
        (tabId: number, info: { windowId: number; isWindowClosing: boolean }) => void
      >(),
      onUpdated: new FakeEvent<(tabId: number, change: Partial<Tab>, tab: Tab) => void>(),
      onActivated: new FakeEvent<(info: { tabId: number; windowId: number }) => void>(),
      onMoved: new FakeEvent<
        (tabId: number, info: { windowId: number; fromIndex: number; toIndex: number }) => void
      >(),
      onAttached: new FakeEvent<
        (tabId: number, info: { newWindowId: number; newPosition: number }) => void
      >(),
      onDetached: new FakeEvent<
        (tabId: number, info: { oldWindowId: number; oldPosition: number }) => void
      >(),
      onReplaced: new FakeEvent<(added: number, removed: number) => void>(),
    },
    windows: {
      onCreated: new FakeEvent<(w: chrome.windows.Window) => void>(),
      onRemoved: new FakeEvent<(id: number) => void>(),
      onFocusChanged: new FakeEvent<(id: number) => void>(),
    },
    tabGroups: {
      onCreated: new FakeEvent<(g: Group) => void>(),
      onUpdated: new FakeEvent<(g: Group) => void>(),
      onRemoved: new FakeEvent<(g: Group) => void>(),
      onMoved: new FakeEvent<(g: Group) => void>(),
    },
    commands: { onCommand: new FakeEvent<(command: string, tab?: Tab) => void>() },
    runtime: { onConnect: new FakeEvent<(port: chrome.runtime.Port) => void>() },
    sidePanel: {
      onOpened: new FakeEvent<(info: { windowId: number }) => void>(),
      onClosed: new FakeEvent<(info: { windowId: number }) => void>(),
    },
  };

  /** Every windowId that received sidePanel.open(), in call order. */
  sidePanelOpened: number[] = [];
  panelBehavior = { openPanelOnActionClick: false };

  reset() {
    this.wins = [];
    this.tabList = [];
    this.groupList = [];
    this.nextTabId = 1;
    this.nextWindowId = 1;
    this.nextGroupId = 1;
    this.lastFocusedId = undefined;
    this.sidePanelOpened = [];
    this.panelBehavior = { openPanelOnActionClick: false };
    for (const area of Object.values(this.events)) for (const ev of Object.values(area)) ev.clear();
    fakeBrowser.reset(); // storage, alarms, runtime
  }

  // ---- test helpers -------------------------------------------------------------------------

  /** Opens a window holding one tab per URL (the last one active). Returns the window id. */
  async openWindow(urls: string[] = ['chrome://newtab/']): Promise<number> {
    const id = this.nextWindowId++;
    this.wins.push({ id, focused: false });
    this.focus(id);
    await this.events.windows.onCreated.trigger(this.winInfo(id));
    for (const url of urls) await this.api.tabs.create({ windowId: id, url });
    return id;
  }

  /** Simulates the user focusing a window. */
  async focusWindow(id: number) {
    this.focus(id);
    await this.events.windows.onFocusChanged.trigger(id);
  }

  /** Simulates a page change (title, favIconUrl, audible, url, status...). Fires tabs.onUpdated. */
  async patchTab(tabId: number, change: Partial<Tab>) {
    const tab = this.mustTab(tabId);
    Object.assign(tab, change);
    await this.events.tabs.onUpdated.trigger(tabId, change, { ...tab });
  }

  /** Sets lastAccessed without any event (Chrome sends none either). */
  setLastAccessed(tabId: number, ms: number) {
    this.mustTab(tabId).lastAccessed = ms;
  }

  // ---- internals ----------------------------------------------------------------------------

  private focus(id: number) {
    for (const w of this.wins) w.focused = w.id === id;
    this.lastFocusedId = id;
  }
  private focusedId() {
    return this.wins.find((w) => w.focused)?.id ?? this.lastFocusedId ?? this.wins[0]?.id;
  }
  private mustTab(id: number) {
    const t = this.tabList.find((x) => x.id === id);
    if (!t) throw new Error(`No tab with id: ${id}.`);
    return t;
  }
  private inWindow(windowId: number) {
    return this.tabList.filter((t) => t.windowId === windowId).sort((a, b) => a.index - b.index);
  }
  private reindex(windowId: number) {
    this.inWindow(windowId).forEach((t, i) => {
      t.index = i;
    });
  }
  private winInfo(id: number, populate = false): chrome.windows.Window {
    const w = this.wins.find((x) => x.id === id);
    if (!w) throw new Error(`No window with id: ${id}.`);
    return {
      id,
      focused: w.focused,
      incognito: false,
      alwaysOnTop: false,
      type: 'normal',
      state: 'normal',
      ...(populate ? { tabs: this.inWindow(id).map((t) => ({ ...t })) } : {}),
    } as chrome.windows.Window;
  }
  private async activate(tab: Tab) {
    for (const t of this.inWindow(tab.windowId)) t.active = t.id === tab.id;
    tab.lastAccessed = Date.now();
    await this.events.tabs.onActivated.trigger({ tabId: tab.id as number, windowId: tab.windowId });
  }
  private async activateNeighbour(windowId: number, nearIndex: number) {
    const left = this.inWindow(windowId);
    const next = left[Math.min(nearIndex, left.length - 1)];
    if (next && !left.some((t) => t.active)) await this.activate(next);
  }
  private async cleanGroups(groupIds: Set<number>) {
    for (const gid of groupIds) {
      if (gid === NONE || this.tabList.some((t) => t.groupId === gid)) continue;
      const i = this.groupList.findIndex((g) => g.id === gid);
      if (i >= 0) {
        const [g] = this.groupList.splice(i, 1);
        await this.events.tabGroups.onRemoved.trigger(g as Group);
      }
    }
  }
  private matches(t: Tab, q: chrome.tabs.QueryInfo) {
    const win = q.currentWindow || q.lastFocusedWindow ? this.focusedId() : q.windowId;
    const urls = q.url === undefined ? undefined : ([] as string[]).concat(q.url);
    const globToRe = (p: string) =>
      new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    return (
      (q.active === undefined || t.active === q.active) &&
      (win === undefined || t.windowId === win) &&
      (q.pinned === undefined || t.pinned === q.pinned) &&
      (q.audible === undefined || !!t.audible === q.audible) &&
      (q.groupId === undefined || t.groupId === q.groupId) &&
      (q.index === undefined || t.index === q.index) &&
      (q.discarded === undefined || t.discarded === q.discarded) &&
      (q.status === undefined || t.status === q.status) &&
      (q.title === undefined || globToRe(q.title).test(t.title ?? '')) &&
      (urls === undefined || urls.some((u) => u === '<all_urls>' || globToRe(u).test(t.url ?? '')))
    );
  }
  private async moveOne(id: number, props: chrome.tabs.MoveProperties): Promise<Tab> {
    const tab = this.mustTab(id);
    const from = { windowId: tab.windowId, index: tab.index };
    const toWindow = props.windowId ?? tab.windowId;
    const siblings = this.inWindow(toWindow).filter((t) => t.id !== id);
    const toIndex = props.index < 0 ? siblings.length : Math.min(props.index, siblings.length);
    const oldGroup = tab.groupId;
    tab.windowId = toWindow;
    siblings.splice(toIndex, 0, tab);
    siblings.forEach((t, i) => {
      t.index = i;
    });
    this.reindex(from.windowId);
    if (toWindow === from.windowId) {
      if (toIndex !== from.index)
        await this.events.tabs.onMoved.trigger(id, {
          windowId: toWindow,
          fromIndex: from.index,
          toIndex,
        });
    } else {
      tab.groupId = NONE; // Chrome drops the group on a cross-window move
      tab.active = false;
      await this.events.tabs.onDetached.trigger(id, {
        oldWindowId: from.windowId,
        oldPosition: from.index,
      });
      await this.events.tabs.onAttached.trigger(id, {
        newWindowId: toWindow,
        newPosition: toIndex,
      });
      await this.activateNeighbour(from.windowId, from.index);
      if (this.inWindow(from.windowId).length === 0) await this.api.windows.remove(from.windowId);
      await this.cleanGroups(new Set([oldGroup]));
    }
    return { ...tab };
  }

  // ---- the fake API surface -----------------------------------------------------------------

  readonly api = {
    windows: {
      WINDOW_ID_NONE: NONE,
      WINDOW_ID_CURRENT: -2,
      ...this.events.windows,
      get: async (id: number, o?: { populate?: boolean }) => this.winInfo(id, o?.populate),
      getAll: async (o?: { populate?: boolean }) =>
        this.wins.map((w) => this.winInfo(w.id, o?.populate)),
      getCurrent: async (o?: { populate?: boolean }) =>
        this.winInfo(this.focusedId() as number, o?.populate),
      getLastFocused: async (o?: { populate?: boolean }) =>
        this.winInfo((this.lastFocusedId ?? this.focusedId()) as number, o?.populate),
      create: async (data: chrome.windows.CreateData = {}) => {
        const id = this.nextWindowId++;
        this.wins.push({ id, focused: false });
        if (data.focused !== false) this.focus(id);
        await this.events.windows.onCreated.trigger(this.winInfo(id));
        if (data.tabId !== undefined) await this.moveOne(data.tabId, { windowId: id, index: 0 });
        else
          for (const url of ([] as string[]).concat(data.url ?? 'chrome://newtab/'))
            await this.api.tabs.create({ windowId: id, url });
        if (data.focused !== false) await this.events.windows.onFocusChanged.trigger(id);
        return this.winInfo(id, true);
      },
      update: async (id: number, info: { focused?: boolean }) => {
        if (info.focused) {
          this.focus(id);
          await this.events.windows.onFocusChanged.trigger(id);
        }
        return this.winInfo(id);
      },
      remove: async (id: number) => {
        for (const t of this.inWindow(id)) {
          this.tabList.splice(this.tabList.indexOf(t), 1);
          await this.events.tabs.onRemoved.trigger(t.id as number, {
            windowId: id,
            isWindowClosing: true,
          });
        }
        this.wins = this.wins.filter((w) => w.id !== id);
        if (this.lastFocusedId === id) this.lastFocusedId = this.wins[0]?.id;
        await this.cleanGroups(new Set(this.groupList.map((g) => g.id)));
        await this.events.windows.onRemoved.trigger(id);
      },
    },
    tabs: {
      TAB_ID_NONE: NONE,
      ...this.events.tabs,
      create: async (props: chrome.tabs.CreateProperties = {}) => {
        const windowId = props.windowId ?? (this.focusedId() as number);
        if (!this.wins.some((w) => w.id === windowId))
          throw new Error(`No window with id: ${windowId}.`);
        const siblings = this.inWindow(windowId);
        const index =
          props.index === undefined ? siblings.length : Math.min(props.index, siblings.length);
        const url = props.url ?? 'chrome://newtab/';
        const tab: Tab = {
          id: this.nextTabId++,
          index,
          windowId,
          url,
          title: url,
          active: false,
          pinned: props.pinned ?? false,
          highlighted: false,
          incognito: false,
          discarded: false,
          autoDiscardable: true,
          frozen: false,
          selected: false,
          groupId: NONE,
          audible: false,
          status: 'complete',
          lastAccessed: Date.now(),
        } as Tab;
        for (const t of siblings) if (t.index >= index) t.index += 1;
        this.tabList.push(tab);
        await this.events.tabs.onCreated.trigger({ ...tab });
        if (props.active !== false) await this.activate(tab);
        return { ...tab };
      },
      get: async (id: number) => ({ ...this.mustTab(id) }),
      query: async (q: chrome.tabs.QueryInfo = {}) =>
        this.tabList
          .filter((t) => this.matches(t, q))
          .sort((a, b) => a.windowId - b.windowId || a.index - b.index)
          .map((t) => ({ ...t })),
      update: async (id: number, props: chrome.tabs.UpdateProperties) => {
        const tab = this.mustTab(id);
        const change: Partial<Tab> = {};
        if (props.url !== undefined && props.url !== tab.url) {
          tab.url = change.url = props.url;
          tab.title = props.url;
        }
        if (props.pinned !== undefined && props.pinned !== tab.pinned)
          tab.pinned = change.pinned = props.pinned;
        if (Object.keys(change).length)
          await this.events.tabs.onUpdated.trigger(id, change, { ...tab });
        if (props.active) await this.activate(tab);
        return { ...tab };
      },
      move: async (ids: number | number[], props: chrome.tabs.MoveProperties) => {
        const list = ([] as number[]).concat(ids);
        const out: Tab[] = [];
        for (const [i, id] of list.entries())
          out.push(
            await this.moveOne(id, { ...props, index: props.index < 0 ? -1 : props.index + i }),
          );
        return Array.isArray(ids) ? out : out[0];
      },
      remove: async (ids: number | number[]) => {
        for (const id of ([] as number[]).concat(ids)) {
          const tab = this.mustTab(id);
          this.tabList.splice(this.tabList.indexOf(tab), 1);
          this.reindex(tab.windowId);
          const last = this.inWindow(tab.windowId).length === 0;
          await this.events.tabs.onRemoved.trigger(id, {
            windowId: tab.windowId,
            isWindowClosing: last,
          });
          await this.cleanGroups(new Set([tab.groupId]));
          if (last) await this.api.windows.remove(tab.windowId);
          else if (tab.active) await this.activateNeighbour(tab.windowId, tab.index);
        }
      },
      reload: async () => {},
      group: async (o: {
        tabIds: number | number[];
        groupId?: number;
        createProperties?: { windowId?: number };
      }) => {
        const ids = ([] as number[]).concat(o.tabIds);
        const first = this.mustTab(ids[0] as number);
        let gid = o.groupId;
        if (gid === undefined) {
          gid = this.nextGroupId++;
          const g = {
            id: gid,
            collapsed: false,
            color: 'grey',
            title: '',
            windowId: o.createProperties?.windowId ?? first.windowId,
          } as Group;
          this.groupList.push(g);
          await this.events.tabGroups.onCreated.trigger({ ...g });
        }
        const group = this.groupList.find((g) => g.id === gid) as Group;
        const olds = new Set<number>();
        for (const id of ids) {
          const t = this.mustTab(id);
          olds.add(t.groupId);
          if (t.windowId !== group.windowId)
            await this.moveOne(id, { windowId: group.windowId, index: -1 });
          t.groupId = gid;
          await this.events.tabs.onUpdated.trigger(id, { groupId: gid }, { ...t });
        }
        await this.cleanGroups(olds);
        return gid;
      },
      ungroup: async (ids: number | number[]) => {
        const olds = new Set<number>();
        for (const id of ([] as number[]).concat(ids)) {
          const t = this.mustTab(id);
          olds.add(t.groupId);
          t.groupId = NONE;
          await this.events.tabs.onUpdated.trigger(id, { groupId: NONE }, { ...t });
        }
        await this.cleanGroups(olds);
      },
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: NONE,
      ...this.events.tabGroups,
      get: async (id: number) => {
        const g = this.groupList.find((x) => x.id === id);
        if (!g) throw new Error(`No group with id: ${id}.`);
        return { ...g };
      },
      query: async (q: chrome.tabGroups.QueryInfo = {}) =>
        this.groupList
          .filter(
            (g) =>
              (q.windowId === undefined || g.windowId === q.windowId) &&
              (q.collapsed === undefined || g.collapsed === q.collapsed) &&
              (q.color === undefined || g.color === q.color) &&
              (q.title === undefined || g.title === q.title),
          )
          .map((g) => ({ ...g })),
      update: async (id: number, props: chrome.tabGroups.UpdateProperties) => {
        const g = this.groupList.find((x) => x.id === id);
        if (!g) throw new Error(`No group with id: ${id}.`);
        Object.assign(g, props);
        await this.events.tabGroups.onUpdated.trigger({ ...g });
        return { ...g };
      },
      move: async (id: number, props: { windowId?: number; index: number }) => {
        const g = this.groupList.find((x) => x.id === id) as Group;
        const ids = this.tabList
          .filter((t) => t.groupId === id)
          .sort((a, b) => a.index - b.index)
          .map((t) => t.id as number);
        await this.api.tabs.move(ids, {
          windowId: props.windowId ?? g.windowId,
          index: props.index,
        });
        await this.events.tabGroups.onMoved.trigger({ ...g });
        return { ...g };
      },
    },
    sidePanel: {
      ...this.events.sidePanel,
      setPanelBehavior: async (b: { openPanelOnActionClick?: boolean }) => {
        Object.assign(this.panelBehavior, b);
      },
      getPanelBehavior: async () => ({ ...this.panelBehavior }),
      open: async (o: { windowId?: number; tabId?: number }) => {
        const wid = o.windowId ?? this.mustTab(o.tabId as number).windowId;
        this.sidePanelOpened.push(wid);
        await this.events.sidePanel.onOpened.trigger({ windowId: wid });
      },
      setOptions: async () => {},
    },
  };

  /**
   * Connects a panel to the worker like chrome.runtime.connect does: the worker's onConnect listeners
   * run at once with the worker-side port. Returns the panel-side port.
   */
  connect(name = 'panel') {
    const { panelPort, workerPort } = makePortPair(name);
    void this.events.runtime.onConnect.trigger(workerPort as unknown as chrome.runtime.Port);
    return panelPort;
  }

  /** Replaces the global fake's windows, tabs, tabGroups and sidePanel, and adds runtime.onConnect and commands.onCommand. */
  install() {
    Object.assign(fakeBrowser, this.api);
    Object.assign(fakeBrowser.commands, { onCommand: this.events.commands.onCommand });
    Object.assign(fakeBrowser.runtime, {
      onConnect: this.events.runtime.onConnect,
      connect: (info?: { name?: string }) => this.connect(info?.name),
    });
  }
}

export const fakeChrome = new FakeChrome();
fakeChrome.install();

/** In-memory runtime.Port pair. Messages arrive on a microtask, structured-cloned like in Chrome. */
export function makePortPair(name = 'panel') {
  const ends = [0, 1].map(() => ({
    message: new FakeEvent<(m: unknown) => void>(),
    disconnect: new FakeEvent<() => void>(),
  }));
  const make = (me: number) => {
    const mine = ends[me] as (typeof ends)[number];
    const other = ends[1 - me] as (typeof ends)[number];
    return {
      name,
      onMessage: mine.message,
      onDisconnect: mine.disconnect,
      postMessage: (m: unknown) => {
        const copy = structuredClone(m);
        queueMicrotask(() => void other.message.trigger(copy));
      },
      disconnect: () => void other.disconnect.trigger(),
    };
  };
  return { panelPort: make(0), workerPort: make(1) };
}
