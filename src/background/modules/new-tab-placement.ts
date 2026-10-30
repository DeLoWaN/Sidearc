import type { PlacementLogEntry } from '../../shared/protocol';
import { isNewTabPageUrl } from '../../shared/url';
import { activeTabsOf, noteActiveTab, noteOpenWindows } from '../active-tabs';
import { readPlacementLog, recordPlacement } from '../placement-log';
import { createQueue } from '../queue';
import { registerRpc } from '../registry';
import { isCreatingTabBySidearc } from '../sidearc-tabs';
import type { WorkerModule } from '../worker-module';
import { getSettings } from './settings';

/** Chrome refuses a move now and then, for example while the user drags a tab. The pauses before try 2 and try 3. */
const RETRY_DELAYS_MS = [100, 400];
const MAX_TRIES = RETRY_DELAYS_MS.length + 1;
/** The worker looks at a tab again for this long after the tab opened. */
const WATCH_MS = 10_000;

type Trigger = PlacementLogEntry['event'];
type Decision = Pick<PlacementLogEntry, 'decision' | 'reason'> & {
  /** True when the worker never looks at this tab again. */
  final: boolean;
};

/** A tab that the worker looks at. It stays in memory for a short time only. */
interface Watch {
  windowId: number;
  /** The address that Chrome first asked for. An overridden New Tab page shows it before its own address. */
  firstPendingUrl: string;
  /**
   * The tabs that were active in the window when the tab opened. It stays empty when the worker knows none,
   * and then any opener counts. Set at the first look.
   */
  activeBefore?: Set<number>;
  openedAt: number;
  tries: number;
  retry?: ReturnType<typeof setTimeout>;
}

const watches = new Map<number, Watch>();
const looks = createQueue();

type Kind = 'blank' | 'new-tab-page' | 'other';

/** What the address of a tab says. An empty address and about:blank are a page that has not started to load. */
function kindOf(tab: chrome.tabs.Tab, watch: Watch): Kind {
  const address = tab.pendingUrl || tab.url || '';
  if (address === '' || address === 'about:blank') return 'blank';
  if (isNewTabPageUrl(address)) return 'new-tab-page';
  // An extension can replace the New Tab page. Its address shows only after Chrome asked for chrome://newtab/.
  const ownHost = new URL(browser.runtime.getURL('/')).host;
  const isOtherExtension =
    address.startsWith('chrome-extension://') && new URL(address).host !== ownHost;
  if (isOtherExtension && isNewTabPageUrl(watch.firstPendingUrl)) return 'new-tab-page';
  return 'other';
}

/** Decides what to do with a tab that the user may have opened. */
async function decide(tab: chrome.tabs.Tab, watch: Watch): Promise<Decision> {
  const kind = kindOf(tab, watch);
  if (kind === 'other')
    return { decision: 'skip', reason: 'The address is a real page', final: true };

  if (tab.openerTabId !== undefined) {
    // A tab that a link opens has an address. A New Tab page with the active tab as opener comes from the user.
    if (kind === 'blank')
      return {
        decision: 'wait',
        reason: 'Blank tab with an opener: the address is not known yet',
        final: false,
      };
    const before = watch.activeBefore;
    if (before && before.size > 0 && !before.has(tab.openerTabId))
      return { decision: 'skip', reason: 'The opener was not the active tab', final: true };
  }
  if (!(await getSettings()).newTabsOnTop)
    return { decision: 'skip', reason: 'The setting is off', final: true };
  const windowType = (await browser.windows.get(tab.windowId).catch(() => undefined))?.type;
  if (windowType !== undefined && windowType !== 'normal')
    return { decision: 'skip', reason: 'The window is not a normal window', final: true };
  // The first tab of a window has no other place to go.
  if ((await browser.tabs.query({ windowId: tab.windowId })).length < 2)
    return { decision: 'skip', reason: 'The only tab of its window', final: true };
  return { decision: 'move', reason: 'A New Tab page that the user opened', final: false };
}

function entryFor(
  tab: chrome.tabs.Tab,
  trigger: Trigger,
  decision: Decision,
  moveResult?: string,
): PlacementLogEntry {
  return {
    time: new Date().toISOString(),
    event: trigger,
    tabId: tab.id as number,
    windowId: tab.windowId,
    index: tab.index,
    openerTabId: tab.openerTabId ?? null,
    url: tab.url ?? '',
    pendingUrl: tab.pendingUrl ?? '',
    status: tab.status ?? '',
    active: tab.active,
    decision: decision.decision,
    reason: decision.reason,
    ...(moveResult === undefined ? {} : { moveResult }),
  };
}

function forget(tabId: number) {
  clearTimeout(watches.get(tabId)?.retry);
  watches.delete(tabId);
}

/**
 * Looks at a watched tab and moves it to the start of the tab strip when the user opened it.
 * A refused move runs again after a pause, and a move that worked never runs again.
 * `shown` is what Chrome reported with the event. Without it the tab comes from `tabs.get`.
 */
async function look(tabId: number, trigger: Trigger, shown?: chrome.tabs.Tab) {
  const watch = watches.get(tabId);
  if (!watch) return;
  if (Date.now() - watch.openedAt > WATCH_MS) return forget(tabId);
  // A pause before the next try holds: an event of the tab must not use up the tries.
  if (trigger !== 'retry' && watch.retry) return;
  watch.retry = undefined;
  // The new tab is not "active before" itself.
  watch.activeBefore ??= new Set((await activeTabsOf(watch.windowId)).filter((id) => id !== tabId));

  const tab = shown ?? (await browser.tabs.get(tabId).catch(() => undefined));
  if (!tab) return;
  const decision = await decide(tab, watch);
  if (decision.decision !== 'move') {
    if (decision.final) forget(tabId);
    await recordPlacement(entryFor(tab, trigger, decision));
    return;
  }

  watch.tries += 1;
  let moveResult = 'moved';
  try {
    await browser.tabs.move(tabId, { index: 0 });
    forget(tabId);
  } catch (error) {
    moveResult = `error: ${error instanceof Error ? error.message : String(error)}`;
    if (watch.tries < MAX_TRIES) {
      watch.retry = setTimeout(
        () => void looks.run(() => look(tabId, 'retry')).catch(console.error),
        RETRY_DELAYS_MS[watch.tries - 1],
      );
    } else forget(tabId);
  }
  await recordPlacement(entryFor(tab, trigger, decision, moveResult));
}

const lookLater = (tabId: number, trigger: Trigger, shown?: chrome.tabs.Tab) =>
  looks.run(() => look(tabId, trigger, shown)).catch(console.error);

const newTabPlacement: WorkerModule = {
  name: 'new-tab-placement',
  order: 40,
  start() {
    noteOpenWindows();

    registerRpc('diagnostics/get', () => readPlacementLog());

    browser.tabs.onCreated.addListener((tab) => {
      if (tab.id === undefined) return;
      for (const [id, watch] of watches) if (Date.now() - watch.openedAt > WATCH_MS) forget(id);
      // Chrome fires `tabs.onCreated` before `tabs.create` answers, so a tab of Sidearc looks like a tab of the user.
      if (isCreatingTabBySidearc(tab.windowId)) return;
      watches.set(tab.id, {
        windowId: tab.windowId,
        firstPendingUrl: tab.pendingUrl ?? '',
        openedAt: Date.now(),
        tries: 0,
      });
      return lookLater(tab.id, 'created', tab);
    });

    browser.tabs.onUpdated.addListener((tabId, changes) => {
      const changed = 'url' in changes || 'status' in changes || 'pendingUrl' in changes;
      if (changed && watches.has(tabId)) return lookLater(tabId, 'updated');
    });

    browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
      noteActiveTab(windowId, tabId);
      if (watches.has(tabId)) return lookLater(tabId, 'activated');
    });

    browser.tabs.onRemoved.addListener((tabId) => forget(tabId));
  },
};
export default newTabPlacement;
