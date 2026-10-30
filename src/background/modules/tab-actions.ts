import { registerCommand } from '../registry';
import type { WorkerModule } from '../worker-module';

const tabActions: WorkerModule = {
  name: 'tab-actions',
  order: 30,
  start() {
    registerCommand('tab/activate', async ({ tabId, windowId }) => {
      const tab = await browser.tabs.update(tabId, { active: true });
      // The panel window is already focused: only another window needs the focus.
      if (tab?.windowId !== undefined && tab.windowId !== windowId) {
        await browser.windows.update(tab.windowId, { focused: true });
      }
    });

    registerCommand('tab/close', ({ tabId }) => browser.tabs.remove(tabId));

    // Without a window id, Chrome keeps the tab in its own window.
    registerCommand('tab/move', ({ tabId, index }) => browser.tabs.move(tabId, { index }));
  },
};
export default tabActions;
