import type { PortMessage } from '../shared/protocol';
import type { SidebarState } from '../shared/types';

/** Composes one part of the sidebar state. It reads Chrome and storage, never memory. */
type Section = () => Promise<Partial<SidebarState>>;

const sections = new Map<string, Section>();
/** Each panel port, with the last state text that it received. */
const ports = new Map<chrome.runtime.Port, string | undefined>();
let flushing = false;
let dirty = false;

/** Adds one part to the sidebar state. A second part with the same name throws. */
export function registerSidebarSection(name: string, compose: Section) {
  if (sections.has(name)) throw new Error(`Sidebar section already registered: ${name}`);
  sections.set(name, compose);
}

async function composeSidebarState(): Promise<SidebarState> {
  const parts = await Promise.all([...sections.values()].map((compose) => compose()));
  return Object.assign({}, ...parts) as SidebarState;
}

/** Sends the full state to the port now, then after every change, until the port closes. */
export function addPanelPort(port: chrome.runtime.Port) {
  ports.set(port, undefined);
  port.onDisconnect.addListener(() => ports.delete(port));
  notifySidebarChanged();
}

/** Tells the hub that something in the state may have changed. Calls in a row share one send. */
export function notifySidebarChanged() {
  dirty = true;
  if (flushing) return; // The running flush sees the flag and loops again.
  flushing = true;
  flush().catch(console.error);
}

/** Sends the state again each time the key changes in that storage area. */
export function notifyOnStorageChange(area: 'local' | 'session', key: string) {
  browser.storage.onChanged.addListener((changes, changedArea) => {
    if (changedArea === area && key in changes) notifySidebarChanged();
  });
}

async function flush() {
  try {
    while (dirty) {
      dirty = false;
      const state = await composeSidebarState();
      const text = JSON.stringify(state);
      const message = { type: 'state', state } satisfies PortMessage;
      for (const [port, lastText] of ports) {
        if (text === lastText) continue;
        ports.set(port, text);
        port.postMessage(message);
      }
    }
  } finally {
    flushing = false;
  }
}
