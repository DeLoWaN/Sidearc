import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeItem, makeState, makeTab } from '../../tests/support/builders';
import { fakeChrome } from '../../tests/support/fake-chrome';
import { PANEL_PORT } from '../shared/protocol';
import type { SidebarState, TabView } from '../shared/types';
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

  it('offers an Undo for a site group that the panel closes, named after its host or its custom name', async () => {
    const [a, b] = [makeTab(), makeTab()] as [TabView, TabView];
    const group = {
      id: 's1',
      host: 'docs.test',
      name: null,
      tabIds: [a.id, b.id],
      collapsed: false,
    };
    const connection = await connectedWith(
      makeState({ unpinnedTabs: [a, b], siteGroups: [group] }),
    );

    connection.send({ type: 'site-group/close', groupId: 's1' });
    expect(usePanelUi.getState().undoToast).toBe('Closed group "docs.test"');

    usePanelStore
      .getState()
      .receive(makeState({ unpinnedTabs: [a, b], siteGroups: [{ ...group, name: 'Manual' }] }));
    connection.send({ type: 'site-group/close', groupId: 's1' });
    expect(usePanelUi.getState().undoToast).toBe('Closed group "Manual"');
  });

  it('offers an Undo for a Tab group that the panel closes, named after its title or its colour', async () => {
    const tab = makeTab();
    const group = {
      id: 7,
      windowId: 1,
      title: 'Work',
      color: 'cyan' as const,
      collapsed: false,
      tabIds: [tab.id],
    };
    const connection = await connectedWith(makeState({ unpinnedTabs: [tab], tabGroups: [group] }));

    connection.send({ type: 'group/close', groupId: 7 });
    expect(usePanelUi.getState().undoToast).toBe('Closed group "Work"');

    usePanelStore
      .getState()
      .receive(makeState({ unpinnedTabs: [tab], tabGroups: [{ ...group, title: '' }] }));
    connection.send({ type: 'group/close', groupId: 7 });
    expect(usePanelUi.getState().undoToast).toBe('Closed group "cyan"');
  });

  it('offers no Undo for a group that the panel does not know', async () => {
    const connection = await connectedWith(makeState());

    connection.send({ type: 'group/close', groupId: 7 });
    connection.send({ type: 'site-group/close', groupId: 'nope' });

    expect(usePanelUi.getState().undoToast).toBeUndefined();
  });

  it('offers an Undo for a selection that the panel closes, with the number of items', async () => {
    const connection = await connectedWith(makeState());

    connection.send({ type: 'selection/close', tabIds: [1, 2], itemIds: ['a'] });
    expect(usePanelUi.getState().undoToast).toBe('Closed 3 items');

    connection.send({ type: 'selection/close', tabIds: [], itemIds: ['a'] });
    expect(usePanelUi.getState().undoToast).toBe('Closed 1 item');
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
