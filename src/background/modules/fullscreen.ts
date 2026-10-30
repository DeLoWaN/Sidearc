import { createQueue } from '../queue';
import { registerRpc } from '../registry';
import type { WorkerModule } from '../worker-module';

export const OPEN_PANELS_STORAGE_KEY = 'openPanels';

/** Ids of the windows whose side panel is open. Session storage keeps them when the worker stops. */
async function readOpenPanels(): Promise<number[]> {
  const stored = await browser.storage.session.get(OPEN_PANELS_STORAGE_KEY);
  return (stored[OPEN_PANELS_STORAGE_KEY] as number[] | undefined) ?? [];
}

const writes = createQueue();

function setPanelOpen(windowId: number, open: boolean) {
  return writes.run(async () => {
    const others = (await readOpenPanels()).filter((id) => id !== windowId);
    await browser.storage.session.set({
      [OPEN_PANELS_STORAGE_KEY]: open ? [...others, windowId] : others,
    });
  });
}

const fullscreen: WorkerModule = {
  name: 'fullscreen',
  order: 90,
  start() {
    browser.sidePanel.onOpened.addListener(({ windowId }) => {
      setPanelOpen(windowId, true).catch(console.error);
    });
    browser.sidePanel.onClosed.addListener(({ windowId }) => {
      setPanelOpen(windowId, false).catch(console.error);
    });

    registerRpc('fullscreen/enter', async (_request, sender) => {
      const windowId = sender.tab?.windowId;
      if (windowId === undefined || !(await readOpenPanels()).includes(windowId)) return false;
      await browser.sidePanel.close({ windowId });
      return true;
    });

    registerRpc('fullscreen/exit', (_request, sender) => {
      const windowId = sender.tab?.windowId;
      if (windowId === undefined) return false;
      // sidePanel.open needs the user gesture that came with the message, so call it here without any await before it.
      // Chrome refuses it when the page sent no gesture, for example after the Escape key.
      return browser.sidePanel.open({ windowId }).then(
        () => true,
        () => false,
      );
    });
  },
};
export default fullscreen;
