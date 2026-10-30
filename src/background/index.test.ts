import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../tests/support/fake-chrome';

beforeEach(() => {
  fakeChrome.reset();
  vi.resetModules();
});

it('starts every module of the modules folder', async () => {
  const { startWorker } = await import('./index');
  startWorker();
  expect(await browser.runtime.sendMessage({ rpc: 'worker/ping', request: 'a' })).toBe('pong a');
});

it('starts the modules in increasing order, ties broken by name', async () => {
  const { workerModules } = await import('./index');
  const keys = workerModules.map((m) => [m.order, m.name] as const);
  expect(keys).toEqual([...keys].sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])));
  expect(new Set(workerModules.map((m) => m.name)).size).toBe(workerModules.length);
});

it('routes a panel command to its handler and survives an unknown command', async () => {
  const { startWorker } = await import('./index');
  const { registerCommand } = await import('./registry');
  const { PANEL_PORT } = await import('../shared/protocol');
  const handler = vi.fn();
  registerCommand('noop', handler);
  startWorker();
  vi.spyOn(console, 'error').mockImplementation(() => {});

  const port = fakeChrome.connect(PANEL_PORT);
  port.postMessage({ type: 'does-not-exist', windowId: 1 });
  port.postMessage({ type: 'noop', windowId: 1 });
  await new Promise((r) => setTimeout(r, 0));

  expect(handler).toHaveBeenCalledOnce();
  expect(handler).toHaveBeenCalledWith({ type: 'noop', windowId: 1 });
});

it('ignores a port that is not the panel port', async () => {
  const { startWorker } = await import('./index');
  const { registerCommand } = await import('./registry');
  const handler = vi.fn();
  registerCommand('noop', handler);
  startWorker();

  fakeChrome.connect('another-port').postMessage({ type: 'noop', windowId: 1 });
  await new Promise((r) => setTimeout(r, 0));

  expect(handler).not.toHaveBeenCalled();
});
