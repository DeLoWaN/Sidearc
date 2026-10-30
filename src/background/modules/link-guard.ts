import { LINK_GUARD_ORIGINS } from '../../link-guard/origins';
import type { LinkGuardPush } from '../../shared/protocol';
import { createQueue } from '../queue';
import { registerRpc } from '../registry';
import type { WorkerModule } from '../worker-module';
import { ITEMS_STORAGE_KEY } from './item-store';
import { getLiveTabs, LIVE_TABS_STORAGE_KEY } from './live-tab-registry';

const SCRIPT_ID = 'link-guard';
const SCRIPT_FILE = 'content-scripts/link-guard.js';

// Two pushes in a row must arrive in order, or a tab would keep an old answer.
const pushes = createQueue();
// Chrome refuses a second registration with the same id.
const registrations = createQueue();

const isWebAddress = (address: string) => /^https?:\/\//i.test(address) && URL.canParse(address);

/** True while the user grants Sidesweep access to web pages, which turns the link guard on. */
const isOn = () => browser.permissions.contains({ origins: LINK_GUARD_ORIGINS });

/**
 * Registers the link guard script while the link guard is on, and unregisters it while it is off.
 * A new registration also runs the script in the web pages that are already open.
 */
const syncRegistration = () => registrations.run(registerWhileOn);

async function registerWhileOn() {
  const [on, registered] = await Promise.all([
    isOn(),
    browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] }),
  ]);
  if (on && registered.length === 0) {
    await browser.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        js: [SCRIPT_FILE],
        matches: LINK_GUARD_ORIGINS,
        runAt: 'document_start',
        persistAcrossSessions: true,
      },
    ]);
    const tabs = await browser.tabs.query({ url: LINK_GUARD_ORIGINS });
    await Promise.all(
      tabs.map((tab) =>
        browser.scripting
          .executeScript({ target: { tabId: tab.id as number }, files: [SCRIPT_FILE] })
          // Chrome refuses some pages, for example the Chrome Web Store.
          .catch(() => {}),
      ),
    );
  }
  if (!on && registered.length > 0) {
    await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  }
}

/** Tells the top frame of every web tab whether it is a live tab now. Every tab is not live while the link guard is off. */
function pushLiveStatus() {
  return pushes.run(async () => {
    const [on, liveTabs, tabs] = await Promise.all([
      isOn(),
      getLiveTabs(),
      browser.tabs.query({ url: LINK_GUARD_ORIGINS }),
    ]);
    const liveIds = new Set(liveTabs.values());
    await Promise.all(
      tabs.map((tab) => {
        const push: LinkGuardPush = {
          type: 'link-guard/live',
          live: on && liveIds.has(tab.id as number),
        };
        // A tab without a link guard, for example one that is still loading, has no listener.
        return browser.tabs.sendMessage(tab.id as number, push, { frameId: 0 }).catch(() => {});
      }),
    );
  });
}

/** Follows a change of the access to web pages. A script that already runs in a page stays, so it must learn that it is off. */
function followAccess() {
  syncRegistration().then(pushLiveStatus).catch(console.error);
}

const linkGuard: WorkerModule = {
  name: 'link-guard',
  order: 40,
  start() {
    registerRpc('link-guard/is-live', async (_request, sender) => {
      if (sender.tab?.id === undefined || !(await isOn())) return false;
      return [...(await getLiveTabs()).values()].includes(sender.tab.id);
    });

    registerRpc('link-guard/open', async ({ url }, sender) => {
      if (!sender.tab || !isWebAddress(url)) return false;
      await browser.tabs.create({
        url,
        windowId: sender.tab.windowId,
        index: sender.tab.index + 1,
        openerTabId: sender.tab.id,
        active: true,
      });
      return true;
    });

    // The live tabs change when an item gets or loses its tab, and when an item is deleted.
    browser.storage.onChanged.addListener((changes, area) => {
      const changed =
        area === 'session'
          ? LIVE_TABS_STORAGE_KEY
          : area === 'local'
            ? ITEMS_STORAGE_KEY
            : undefined;
      if (changed && changed in changes) pushLiveStatus().catch(console.error);
    });

    // The user grants or removes the access on the options page, or in the Chrome settings.
    browser.permissions.onAdded.addListener(followAccess);
    browser.permissions.onRemoved.addListener(followAccess);
    syncRegistration().catch(console.error);
  },
};
export default linkGuard;
