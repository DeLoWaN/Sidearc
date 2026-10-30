import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { type BrowserContext, chromium, type Page, type Worker } from '@playwright/test';
import { test as base, expect } from './fixtures';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../../.output/chrome-mv3');

// Playwright cannot click the Sidesweep icon. A click that leaves fullscreen opens the real side panel instead,
// because the guard asks for it and the click carries a user gesture.
// The open panel takes room from the page, so the width of the page shows whether the panel is open.

const test = base.extend<{ videoUrl: string }>({
  // No viewport emulation: the page must shrink when the side panel opens.
  context: async ({}, use) => {
    const context: BrowserContext = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.env.HEADED,
      viewport: null,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },
  videoUrl: async ({}, use) => {
    const page = `<!doctype html><title>video</title>
<div id="player" style="width:320px;height:180px;background:#000">
  <button id="exit" onclick="document.exitFullscreen()">exit</button>
</div>
<button id="enter" onclick="document.getElementById('player').requestFullscreen()">enter</button>`;
    const server: Server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(page);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    await use(`http://127.0.0.1:${(server.address() as AddressInfo).port}/video`);
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  },
});

const pageWidth = (page: Page) => page.evaluate(() => window.innerWidth);

/** The width of the page once the side panel stopped its open or close animation. */
async function settledWidth(page: Page) {
  let last = -1;
  for (;;) {
    const width = await pageWidth(page);
    if (width === last) return width;
    last = width;
    await page.waitForTimeout(300);
  }
}
const fullscreenId = (page: Page) => page.evaluate(() => document.fullscreenElement?.id ?? null);

async function enterFullscreen(page: Page) {
  await page.click('#enter');
  await expect.poll(() => fullscreenId(page)).toBe('player');
}

/** Opens the real side panel. Answers the width of the page without the panel and with it. */
async function openPanel(page: Page, serviceWorker: Worker) {
  const fullWidth = await pageWidth(page);
  // Marks the window as one with an open panel, so that the exit below asks to open it.
  await serviceWorker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    await chrome.storage.session.set({ openPanels: [tab?.windowId] });
  }, page.url());
  await enterFullscreen(page);
  await page.click('#exit');
  await expect.poll(() => pageWidth(page)).toBeLessThan(fullWidth);
  return { fullWidth, widthWithPanel: await settledWidth(page) };
}

test('closes the side panel in fullscreen and opens it again after a click on exit', async ({
  context,
  serviceWorker,
  videoUrl,
}) => {
  const page = await context.newPage();
  await page.goto(videoUrl);
  const { fullWidth, widthWithPanel } = await openPanel(page, serviceWorker);

  await enterFullscreen(page);
  await page.click('#exit');

  await expect.poll(() => fullscreenId(page)).toBeNull();
  await expect.poll(() => pageWidth(page)).toBe(widthWithPanel);
  expect(widthWithPanel).toBeLessThan(fullWidth);
});

test('opens the side panel again on the next click after a fullscreen exit without a gesture', async ({
  context,
  serviceWorker,
  videoUrl,
}) => {
  test.slow();
  const page = await context.newPage();
  await page.goto(videoUrl);
  const { fullWidth, widthWithPanel } = await openPanel(page, serviceWorker);

  await enterFullscreen(page);
  // A page timer leaves fullscreen after the gesture of the click on enter expired, as the Escape key does.
  await page.evaluate(() => {
    setTimeout(() => document.exitFullscreen(), 6000);
  });
  // page.evaluate gives the page a gesture, so the test makes no call until the timer ran.
  await page.waitForTimeout(7000);
  expect(await fullscreenId(page)).toBeNull();
  expect(await settledWidth(page)).toBe(fullWidth);

  await page.mouse.click(600, 400);

  await expect.poll(() => pageWidth(page)).toBe(widthWithPanel);
});
