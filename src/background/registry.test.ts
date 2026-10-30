import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../tests/support/fake-chrome';
import {
  clearRegistries,
  dispatchCommand,
  registerCommand,
  registerRpc,
  startRpcRouter,
} from './registry';

beforeEach(() => {
  fakeChrome.reset();
  clearRegistries();
});

it('sends a command to the handler registered for its type', async () => {
  const handler = vi.fn();
  registerCommand('noop', handler);
  await dispatchCommand({ type: 'noop', windowId: 1 });
  expect(handler).toHaveBeenCalledWith({ type: 'noop', windowId: 1 });
});

it('refuses a command that has no handler', async () => {
  await expect(dispatchCommand({ type: 'noop', windowId: 1 })).rejects.toThrow(
    'Unknown command: noop',
  );
});

it('refuses two handlers for one command', () => {
  registerCommand('noop', () => {});
  expect(() => registerCommand('noop', () => {})).toThrow('Command already registered: noop');
});

it('answers a one-off request through runtime.sendMessage', async () => {
  registerRpc('worker/ping', (request) => `pong ${request}`);
  startRpcRouter();
  expect(await browser.runtime.sendMessage({ rpc: 'worker/ping', request: 'a' })).toBe('pong a');
});

it('leaves a message that is not an rpc unanswered', async () => {
  registerRpc('worker/ping', (request) => `pong ${request}`);
  startRpcRouter();
  expect(await browser.runtime.sendMessage({ other: true })).toBeUndefined();
});

it('refuses two handlers for one rpc', () => {
  registerRpc('worker/ping', () => 'pong');
  expect(() => registerRpc('worker/ping', () => 'pong')).toThrow(
    'RPC already registered: worker/ping',
  );
});
