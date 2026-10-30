import { PANEL_PORT } from '../../shared/protocol';
import { addPanelPort } from '../sidebar-hub';
import type { WorkerModule } from '../worker-module';

const sidebarPublisher: WorkerModule = {
  name: 'sidebar-publisher',
  order: 90,
  start() {
    browser.runtime.onConnect.addListener((port) => {
      if (port.name === PANEL_PORT) addPanelPort(port);
    });
  },
};
export default sidebarPublisher;
