import { beforeEach, expect, it, vi } from 'vitest';
import type { RpcMessage } from '../shared/protocol';
import { startFullscreenGuard } from './guard';

let fullscreenElement: Element | null = null;
/** The document listeners of the guard. They stay out of the shared document, so a test never sees the guard of another test. */
let listeners: Map<string, Set<(event: Event) => void>>;
let sent: RpcMessage[] = [];
/** The answer of the worker to the next enter message. */
let panelWasOpen = true;
/** The answer of the worker to the next exit message: false when Chrome saw no user gesture. */
let panelOpens = true;

const answersArrive = () => new Promise((resolve) => setTimeout(resolve, 0));

function fire(type: string, event: Event = new Event(type)) {
  for (const listener of listeners.get(type) ?? []) listener(event);
}

/** Plays the page: sets its fullscreen element and fires the change, without waiting for the answers. */
function changeFullscreen(element: Element | null) {
  fullscreenElement = element;
  fire('fullscreenchange');
}

async function setFullscreen(element: Element | null) {
  changeFullscreen(element);
  await answersArrive();
}

/** Plays a click of the user in the page. */
async function userClick() {
  // happy-dom makes every event untrusted, and a real click is trusted.
  fire('pointerdown', { type: 'pointerdown', isTrusted: true } as Event);
  await answersArrive();
}

const video = () => document.createElement('video');
const sentNames = () => sent.map((message) => message.rpc);

beforeEach(() => {
  fullscreenElement = null;
  listeners = new Map();
  sent = [];
  panelWasOpen = true;
  panelOpens = true;
  // happy-dom has no Fullscreen API.
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
  });
  vi.spyOn(document, 'addEventListener').mockImplementation(((
    type: string,
    listener: (event: Event) => void,
  ) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)?.add(listener);
  }) as never);
  vi.spyOn(document, 'removeEventListener').mockImplementation(((
    type: string,
    listener: (event: Event) => void,
  ) => {
    listeners.get(type)?.delete(listener);
  }) as never);
  vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (message: RpcMessage) => {
    sent.push(message);
    return message.rpc === 'fullscreen/enter' ? panelWasOpen : panelOpens;
  }) as never);
  startFullscreenGuard();
});

it('asks to close the panel on enter and to open it again on exit', async () => {
  await setFullscreen(video());
  await setFullscreen(null);

  expect(sentNames()).toEqual(['fullscreen/enter', 'fullscreen/exit']);
});

it('does not ask to open a panel that was closed before the fullscreen', async () => {
  panelWasOpen = false;

  await setFullscreen(video());
  await setFullscreen(null);
  await userClick();

  expect(sentNames()).toEqual(['fullscreen/enter']);
});

it('sends one enter when the fullscreen element changes', async () => {
  await setFullscreen(video());
  await setFullscreen(video());
  await setFullscreen(null);

  expect(sentNames()).toEqual(['fullscreen/enter', 'fullscreen/exit']);
});

it('opens the panel again when the page leaves fullscreen before the answer arrives', async () => {
  changeFullscreen(video());
  changeFullscreen(null);
  await answersArrive();

  expect(sentNames()).toEqual(['fullscreen/enter', 'fullscreen/exit']);
});

it('asks again on the next click when Chrome refused to open the panel', async () => {
  await setFullscreen(video());
  panelOpens = false;
  await setFullscreen(null);
  panelOpens = true;

  await userClick();
  await userClick();

  expect(sentNames()).toEqual(['fullscreen/enter', 'fullscreen/exit', 'fullscreen/exit']);
});

it('ignores a click that a script makes', async () => {
  await setFullscreen(video());
  panelOpens = false;
  await setFullscreen(null);

  fire('pointerdown');
  await answersArrive();

  expect(sentNames()).toEqual(['fullscreen/enter', 'fullscreen/exit']);
});

it('waits for the next exit when the page enters fullscreen again before a click', async () => {
  await setFullscreen(video());
  panelOpens = false;
  await setFullscreen(null);
  panelOpens = true;

  await setFullscreen(video());
  await userClick();
  await setFullscreen(null);

  // The panel is still closed, so the second enter sends nothing.
  expect(sentNames()).toEqual(['fullscreen/enter', 'fullscreen/exit', 'fullscreen/exit']);
});
