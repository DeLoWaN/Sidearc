import { closeAndArchive } from '../archiving';
import { registerCommand } from '../registry';
import type { WorkerModule } from '../worker-module';

const clearTabs: WorkerModule = {
  name: 'clear-tabs',
  order: 30,
  start() {
    registerCommand('tab/clear', () => closeAndArchive((tabs) => tabs));
  },
};
export default clearTabs;
