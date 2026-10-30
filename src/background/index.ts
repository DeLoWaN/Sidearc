import type { WorkerModule } from './worker-module';

// Every file in ./modules is a module. A new module never edits this file.
const files = import.meta.glob<{ default: WorkerModule }>(
  ['./modules/*.ts', '!./modules/*.test.ts'],
  { eager: true },
);

export const workerModules: WorkerModule[] = Object.values(files)
  .map((file) => file.default)
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

/** Starts every module. Call it synchronously at the top level of the service worker. */
export function startWorker() {
  for (const module of workerModules) module.start();
}
