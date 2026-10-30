import { type Command, PANEL_PORT, type PortMessage } from '../shared/protocol';
import { usePanelStore } from './store';
import { usePanelUi } from './ui-store';

/** A command as the panel writes it: the connection adds the window id. */
export type CommandBody = Command extends infer C
  ? C extends unknown
    ? Omit<C, 'windowId'>
    : never
  : never;

export interface Connection {
  /** The window that holds this panel. */
  windowId: number;
  send(command: CommandBody): void;
}

/**
 * Opens the port to the worker and feeds the store with every state it sends.
 * Opens a new port when the worker stops, which also wakes the worker.
 */
export async function connectToWorker(): Promise<Connection> {
  const { id: windowId } = await browser.windows.getCurrent();
  if (windowId === undefined) throw new Error('The panel has no window id');

  let port: chrome.runtime.Port;
  const open = () => {
    port = browser.runtime.connect({ name: PANEL_PORT });
    port.onMessage.addListener((message: PortMessage) => {
      if (message.type === 'state') usePanelStore.getState().receive(message.state);
      if (message.type === 'notice') usePanelUi.getState().showNotice(message.message);
    });
    port.onDisconnect.addListener(open);
  };
  open();

  return { windowId, send: (command) => port.postMessage({ ...command, windowId }) };
}
