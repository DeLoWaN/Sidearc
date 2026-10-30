import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../tests/support/fake-chrome';
import { PANEL_PORT } from '../shared/protocol';
import type { SidebarState } from '../shared/types';
import { connectToWorker } from './connection';
import { resetPanelStore, usePanelStore } from './store';
import { resetPanelUi, usePanelUi } from './ui-store';

type WorkerPort = chrome.runtime.Port;

beforeEach(() => {
  fakeChrome.reset();
  resetPanelStore();
  resetPanelUi();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Plays the worker: keeps each port that the panel opens and records what the panel sends. */
function fakeWorker() {
  const ports: WorkerPort[] = [];
  const received: unknown[] = [];
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== PANEL_PORT) return;
    ports.push(port);
    port.onMessage.addListener((message) => received.push(message));
  });
  return { ports, received };
}

it('puts each state that the worker sends into the store', async () => {
  const worker = fakeWorker();
  await fakeChrome.openWindow(['https://a.test/']);
  await connectToWorker();
  const state = { marker: 'first' } as unknown as SidebarState;
  worker.ports[0]?.postMessage({ type: 'state', state });
  await settle();
  expect(usePanelStore.getState().state).toEqual(state);
});

it('sends a command with the id of the window that holds the panel', async () => {
  const worker = fakeWorker();
  await fakeChrome.openWindow(['https://a.test/']);
  const second = await fakeChrome.openWindow(['https://b.test/']);
  const connection = await connectToWorker();
  connection.send({ type: 'tab/close', tabId: 1 });
  await settle();
  expect(worker.received).toEqual([{ type: 'tab/close', tabId: 1, windowId: second }]);
});

it('connects again when the worker stops, and keeps sending commands', async () => {
  const worker = fakeWorker();
  const window = await fakeChrome.openWindow(['https://a.test/']);
  const connection = await connectToWorker();
  worker.ports[0]?.disconnect();
  await vi.waitFor(() => expect(worker.ports).toHaveLength(2));
  connection.send({ type: 'tab/close', tabId: 1 });
  await settle();
  expect(worker.received).toEqual([{ type: 'tab/close', tabId: 1, windowId: window }]);
});

it('shows the notice that the worker sends', async () => {
  const worker = fakeWorker();
  await fakeChrome.openWindow(['https://a.test/']);
  await connectToWorker();
  worker.ports[0]?.postMessage({ type: 'notice', message: 'Too many Favorites' });
  await settle();
  expect(usePanelUi.getState().notice).toBe('Too many Favorites');
});
