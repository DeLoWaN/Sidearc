import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeItem, makeState, makeTab } from '../../tests/support/builders';
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

describe('the Undo toast', () => {
  async function connectedWith(state: SidebarState) {
    fakeWorker();
    await fakeChrome.openWindow(['https://a.test/']);
    usePanelStore.getState().receive(state);
    return connectToWorker();
  }

  it('offers an Undo for an item that the panel deletes', async () => {
    const item = makeItem({ title: 'Mail' });
    const connection = await connectedWith(makeState({ items: [item] }));

    connection.send({ type: 'item/delete', itemId: item.id });

    expect(usePanelUi.getState().undoToast).toBe('Deleted "Mail"');
  });

  it('offers an Undo for an Unpinned Tab that the panel closes', async () => {
    const tab = makeTab({ title: 'Wiki' });
    const connection = await connectedWith(makeState({ unpinnedTabs: [tab] }));

    connection.send({ type: 'tab/close', tabId: tab.id });

    expect(usePanelUi.getState().undoToast).toBe('Closed "Wiki"');
  });

  it('offers no Undo for the close of a live tab', async () => {
    const item = makeItem({ title: 'Mail', live: { tabId: 40 } });
    const connection = await connectedWith(makeState({ items: [item] }));

    connection.send({ type: 'tab/close', tabId: 40 });

    expect(usePanelUi.getState().undoToast).toBeUndefined();
  });

  it('hides the toast when any other command goes out, or when the worker sends a notice', async () => {
    const item = makeItem({ title: 'Mail' });
    const worker = fakeWorker();
    await fakeChrome.openWindow(['https://a.test/']);
    usePanelStore.getState().receive(makeState({ items: [item] }));
    const connection = await connectToWorker();

    connection.send({ type: 'item/delete', itemId: item.id });
    connection.send({ type: 'options/open' });
    expect(usePanelUi.getState().undoToast).toBeUndefined();

    connection.send({ type: 'item/delete', itemId: item.id });
    worker.ports[0]?.postMessage({ type: 'notice', message: 'Too many Favorites' });
    await settle();
    expect(usePanelUi.getState().undoToast).toBeUndefined();
  });
});

it('shows the notice that the worker sends', async () => {
  const worker = fakeWorker();
  await fakeChrome.openWindow(['https://a.test/']);
  await connectToWorker();
  worker.ports[0]?.postMessage({ type: 'notice', message: 'Too many Favorites' });
  await settle();
  expect(usePanelUi.getState().notice).toBe('Too many Favorites');
});
