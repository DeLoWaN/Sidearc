import { vi } from 'vitest';
import type { CommandBody } from '../../src/panel/connection';
import { PANEL_PORT, type PortMessage } from '../../src/shared/protocol';
import type { SidebarState } from '../../src/shared/types';
import { fakeChrome } from './fake-chrome';

/** Waits until every pending promise of the fake worker has run. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Starts a new copy of the service worker, like Chrome does after it stopped the old one. */
export async function startWorker() {
  vi.resetModules();
  const { startWorker } = await import('../../src/background');
  startWorker();
}

/** Ends the running worker: no listener stays on the fake Chrome. Tabs and windows stay. */
export function stopWorker() {
  for (const area of Object.values(fakeChrome.events))
    for (const event of Object.values(area)) event.clear();
}

/** Plays a panel: opens the port, keeps every state it receives, and sends commands. */
export function connectPanel(windowId: number) {
  const port = fakeChrome.connect(PANEL_PORT);
  const states: SidebarState[] = [];
  const notices: string[] = [];
  port.onMessage.addListener((message) => {
    const received = message as PortMessage;
    if (received.type === 'state') states.push(received.state);
    else notices.push(received.message);
  });
  return {
    /** Every state received, oldest first. */
    states,
    /** Every notice received, oldest first. */
    notices,
    latest: () => states.at(-1),
    send(command: CommandBody) {
      port.postMessage({ ...command, windowId });
    },
  };
}
