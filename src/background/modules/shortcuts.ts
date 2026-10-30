import type { WorkerModule } from '../worker-module';

const shortcuts: WorkerModule = {
  name: 'shortcuts',
  order: 90,
  start() {
    browser.commands.onCommand.addListener((command, tab) => {
      // sidePanel.open needs a user gesture, so call it here without any await before it.
      if (command === 'open-panel' && tab?.windowId !== undefined) {
        browser.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
      }
    });
  },
};
export default shortcuts;
