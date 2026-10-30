import type { LinkGuardPush } from '../../shared/protocol';
import { createQueue } from '../queue';
import { registerRpc } from '../registry';
import type { WorkerModule } from '../worker-module';
import { getLiveTabs } from './live-tab-registry';

const WEB_TABS = ['http://*/*', 'https://*/*'];

// Two pushes in a row must arrive in order, or a tab would keep an old answer.
const pushes = createQueue();

const isWebAddress = (address: string) => /^https?:\/\//i.test(address) && URL.canParse(address);

/** Tells the top frame of every web tab whether it is a live tab now. */
function pushLiveStatus() {
  return pushes.run(async () => {
    const [liveTabs, tabs] = await Promise.all([
      getLiveTabs(),
      browser.tabs.query({ url: WEB_TABS }),
    ]);
    const liveIds = new Set(liveTabs.values());
    await Promise.all(
      tabs.map((tab) => {
        const push: LinkGuardPush = {
          type: 'link-guard/live',
          live: liveIds.has(tab.id as number),
        };
        // A tab without a link guard, for example one that is still loading, has no listener.
        return browser.tabs.sendMessage(tab.id as number, push, { frameId: 0 }).catch(() => {});
      }),
    );
  });
}

const linkGuard: WorkerModule = {
  name: 'link-guard',
  order: 40,
  start() {
    registerRpc('link-guard/is-live', async (_request, sender) => {
      if (sender.tab?.id === undefined) return false;
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
      const changed = area === 'session' ? 'liveTabs' : area === 'local' ? 'items' : undefined;
      if (changed && changed in changes) pushLiveStatus().catch(console.error);
    });
  },
};
export default linkGuard;
