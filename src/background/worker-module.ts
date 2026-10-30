/** A unit of the service worker. Each file in src/background/modules/ default-exports one. */
export interface WorkerModule {
  /** Unique name. */
  name: string;
  /** Lower starts first. Ties go by name. 5 router, 10 stores, 20 tab lists, 30 tab actions, 40 alarms and guards, 50 import, 90 views. */
  order: number;
  /** Registers Chrome listeners. Runs synchronously on every worker start, with no await before it. */
  start(): void;
}
