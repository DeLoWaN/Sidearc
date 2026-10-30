import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../../.output/chrome-mv3');

type Fixtures = {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  /** Local HTTP server. Routes: GET /form (text field page), GET /other, GET /blank. */
  site: { origin: string };
};

export const test = base.extend<Fixtures>({
  // Each test gets its own browser profile (empty userDataDir => temp dir).
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', // new headless mode: full Chromium, extensions work
      headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(sw);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
  site: async ({}, use) => {
    const pages: Record<string, string> = {
      '/form':
        '<!doctype html><title>form</title><input id="field"><script>window.__marker = Math.random();</script>',
      '/other': '<!doctype html><title>other</title><p>other</p>',
      '/blank': '<!doctype html><title>blank</title>',
    };
    const server: Server = createServer((req, res) => {
      const body = pages[req.url ?? ''];
      res.writeHead(body ? 200 : 404, { 'content-type': 'text/html' });
      res.end(body ?? 'not found');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    await use({ origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    server.closeAllConnections(); // keep-alive sockets would block close()
    await new Promise((r) => server.close(r));
  },
});

export const expect = test.expect;
