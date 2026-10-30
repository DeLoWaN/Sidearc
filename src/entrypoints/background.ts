import { startWorker } from '../background';

export default defineBackground(() => {
  startWorker();
});
