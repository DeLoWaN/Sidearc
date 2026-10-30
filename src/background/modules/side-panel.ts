import type { WorkerModule } from '../worker-module';

const sidePanel: WorkerModule = {
  name: 'side-panel',
  order: 90,
  start() {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  },
};
export default sidePanel;
