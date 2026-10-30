import { registerRpc } from '../registry';
import type { WorkerModule } from '../worker-module';

const diagnostics: WorkerModule = {
  name: 'diagnostics',
  order: 10,
  start() {
    // Answers with the request. A view uses it to check that the worker is alive.
    registerRpc('worker/ping', (request) => `pong ${request}`);
  },
};
export default diagnostics;
