/** A unit of the service worker. Each file in src/background/modules/ default-exports one. */
export interface WorkerModule {
  /** Unique name. */
  name: string;
  /** Lower starts first. Use steps of 10: 10 stores, 20 tab registry, 30 actions, 40 alarms, 90 ports. */
  order: number;
  /** Registers Chrome listeners. Runs synchronously on every worker start, with no await before it. */
  start(): void;
}
