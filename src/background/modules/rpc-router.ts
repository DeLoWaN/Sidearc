import { startRpcRouter } from '../registry';
import type { WorkerModule } from '../worker-module';

const rpcRouter: WorkerModule = { name: 'rpc-router', order: 5, start: startRpcRouter };
export default rpcRouter;
