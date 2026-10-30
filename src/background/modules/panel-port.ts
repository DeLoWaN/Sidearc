import { type Command, PANEL_PORT } from '../../shared/protocol';
import { dispatchCommand } from '../registry';
import type { WorkerModule } from '../worker-module';

const panelPort: WorkerModule = {
  name: 'panel-port',
  order: 90,
  start() {
    browser.runtime.onConnect.addListener((port) => {
      if (port.name !== PANEL_PORT) return;
      port.onMessage.addListener((message: Command) => {
        // One bad command must not stop the next ones.
        dispatchCommand(message).catch(console.error);
      });
    });
  },
};
export default panelPort;
