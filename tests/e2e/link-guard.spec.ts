import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { test as base, expect } from './fixtures';

// `*.localhost` names all reach the local server, so one server plays several hosts.

type Web = {
  /** Address of a page on a host, for example `url('b.localhost', '/landing')`. */
  url: (host: string, path: string) => string;
};

const test = base.extend<{ web: Web }>({
  web: async ({}, use) => {
    let port = 0;
    const url = (host: string, path: string) => `http://${host}:${port}${path}`;
    const links = (host: string) => `<!doctype html><title>links ${host}</title>
<a id="other" href="${url('b.localhost', '/landing')}">other host</a>
<a id="same-relative" href="/landing">same host, relative</a>
<a id="same-absolute" href="${url(host, '/landing')}">same host, absolute</a>
<a id="subdomain" href="${url(`sub.${host}`, '/landing')}">subdomain</a>
<a id="other-port" href="http://${host}:${port + 1}/landing">other port</a>
<a id="blank" target="_blank" href="${url('b.localhost', '/landing')}">new tab link</a>
<a id="redirect" href="/redirect">redirect</a>
<a id="probe" href="${url('b.localhost', '/probe')}">probe</a>
<button id="script" onclick="location.href='${url('b.localhost', '/landing')}'">script</button>
<script>
  window.__marker = Math.random();
  window.__clicks = [];
  // Runs after the link guard, so it sees whether the guard cancelled the click.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    window.__clicks.push({ id: link.id, prevented: event.defaultPrevented });
    if (link.id === 'probe') event.preventDefault();
  });
</script>`;
    const server: Server = createServer((req, res) => {
      const host = (req.headers.host ?? '').split(':')[0] ?? '';
      if (req.url === '/redirect') {
        res.writeHead(302, { location: url('b.localhost', '/landing') });
        res.end();
        return;
      }
      const body =
        req.url === '/links' ? links(host) : `<!doctype html><title>landing ${host}</title>`;
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(body);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
    await use({ url });
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  },
});

const hasPage = (context: BrowserContext, url: string) =>
  context.pages().some((page) => page.url() === url);

/** Pins the page at the saved URL, opens its live tab from the panel, and waits until the guard is on. */
async function openLiveTab(
  context: BrowserContext,
  serviceWorker: Worker,
  extensionId: string,
  savedUrl: string,
): Promise<Page> {
  await serviceWorker.evaluate(async (url) => {
    await chrome.storage.local.set({
      items: [
        {
          id: 'p1',
          kind: 'pinned',
          title: 'Saved',
          url,
          parentId: null,
          position: 0,
          collapsed: false,
        },
      ],
    });
  }, savedUrl);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const opened = context.waitForEvent('page');
  await panel.getByRole('button', { name: 'Saved', exact: true }).click();
  const live = await opened;
  await live.waitForLoadState();

  // The guard has no visible state. A click on the probe link shows it: the guard cancels the click when it is on.
  await expect
    .poll(async () => {
      await live.click('#probe');
      return (await clicks(live)).at(-1)?.prevented;
    })
    .toBe(true);
  for (const page of context.pages()) if (page.url().endsWith('/probe')) await page.close();
  await live.evaluate(() => {
    (window as unknown as PageState).__clicks = [];
  });
  return live;
}

/** What the test page records about itself. */
type PageState = { __clicks: { id: string; prevented: boolean }[]; __marker: number };

const clicks = (page: Page) => page.evaluate(() => (window as unknown as PageState).__clicks);

/** A number the page makes at load. A reload changes it. */
const marker = (page: Page) => page.evaluate(() => (window as unknown as PageState).__marker);

/** Ids of the tabs that are the live tab of an item. */
const liveTabIds = (serviceWorker: Worker) =>
  serviceWorker.evaluate(async () => {
    const stored = await chrome.storage.session.get('liveTabs');
    return Object.values((stored.liveTabs ?? {}) as Record<string, number>);
  });

const tabIdOf = (serviceWorker: Worker, url: string) =>
  serviceWorker.evaluate(async (u) => (await chrome.tabs.query({ url: u }))[0]?.id, url);

test('a link to another host opens a new Unpinned Tab and the live tab does not navigate', async ({
  context,
  extensionId,
  serviceWorker,
  web,
}) => {
  const savedUrl = web.url('a.localhost', '/links');
  const live = await openLiveTab(context, serviceWorker, extensionId, savedUrl);
  const before = await marker(live);
  const target = web.url('b.localhost', '/landing');

  await live.click('#other');

  await expect.poll(() => hasPage(context, target)).toBe(true);
  expect(live.url()).toBe(savedUrl);
  expect(await marker(live)).toBe(before);
  expect(await clicks(live)).toEqual([{ id: 'other', prevented: true }]);
  // The new tab belongs to no item.
  const newTabId = await tabIdOf(serviceWorker, target);
  expect(newTabId).toBeDefined();
  expect(await liveTabIds(serviceWorker)).not.toContain(newTabId);
});

test('a link to a different subdomain opens a new Unpinned Tab', async ({
  context,
  extensionId,
  serviceWorker,
  web,
}) => {
  const savedUrl = web.url('a.localhost', '/links');
  const live = await openLiveTab(context, serviceWorker, extensionId, savedUrl);

  await live.click('#subdomain');

  await expect.poll(() => hasPage(context, web.url('sub.a.localhost', '/landing'))).toBe(true);
  expect(live.url()).toBe(savedUrl);
});

test('a link to the same name on another port opens a new Unpinned Tab', async ({
  context,
  extensionId,
  serviceWorker,
  web,
}) => {
  const savedUrl = web.url('a.localhost', '/links');
  const live = await openLiveTab(context, serviceWorker, extensionId, savedUrl);

  expect((await clicks(live)).length).toBe(0);
  // Nothing listens on the other port: the new tab opens an error page, but it opens.
  const opened = context.waitForEvent('page');
  await live.click('#other-port');
  await opened;

  expect(live.url()).toBe(savedUrl);
});

test('a link to the same host stays in the live tab', async ({
  context,
  extensionId,
  serviceWorker,
  web,
}) => {
  const savedUrl = web.url('a.localhost', '/links');
  const live = await openLiveTab(context, serviceWorker, extensionId, savedUrl);
  const tabsBefore = context.pages().length;

  await live.click('#same-relative');
  await live.waitForURL(web.url('a.localhost', '/landing'));
  await live.goBack();
  await live.waitForURL(savedUrl);
  await live.click('#same-absolute');
  await live.waitForURL(web.url('a.localhost', '/landing'));

  expect(context.pages().length).toBe(tabsBefore);
});

test('redirects, script navigations and modifier clicks are untouched', async ({
  context,
  extensionId,
  serviceWorker,
  web,
}) => {
  const savedUrl = web.url('a.localhost', '/links');
  const live = await openLiveTab(context, serviceWorker, extensionId, savedUrl);

  // A modifier click keeps the normal Chrome behaviour: the page sees a click that nobody cancelled.
  await live.click('#other', { modifiers: ['ControlOrMeta'] });
  expect(await clicks(live)).toEqual([{ id: 'other', prevented: false }]);
  expect(live.url()).toBe(savedUrl);

  // A link with target="_blank" keeps its normal behaviour too.
  await live.click('#blank');
  expect(await clicks(live)).toContainEqual({ id: 'blank', prevented: false });
  expect(live.url()).toBe(savedUrl);

  // A script navigation stays in the live tab.
  await live.click('#script');
  await live.waitForURL(web.url('b.localhost', '/landing'));
  await live.goBack();
  await live.waitForURL(savedUrl);

  // A redirect to another host stays in the live tab.
  const pagesBefore = context.pages().length;
  await live.click('#redirect');
  await live.waitForURL(web.url('b.localhost', '/landing'));
  expect(context.pages().length).toBe(pagesBefore);
});

test('in an Unpinned Tab, a link to another host behaves normally', async ({ context, web }) => {
  const page = await context.newPage();
  await page.goto(web.url('a.localhost', '/links'));
  const tabsBefore = context.pages().length;

  await page.click('#other');

  await page.waitForURL(web.url('b.localhost', '/landing'));
  expect(context.pages().length).toBe(tabsBefore);
});

test('a tab that is pinned after it loaded starts to guard its links', async ({
  context,
  serviceWorker,
  web,
}) => {
  const url = web.url('a.localhost', '/links');
  const page = await context.newPage();
  await page.goto(url);
  // The page is already open and not live. The click guard must hear about the pin that follows.
  await serviceWorker.evaluate(
    async ([tabUrl, tabId]) => {
      const item = { id: 'p1', kind: 'pinned', title: 'Saved', url: tabUrl };
      await chrome.storage.local.set({
        items: [{ ...item, parentId: null, position: 0, collapsed: false }],
      });
      await chrome.storage.session.set({ liveTabs: { p1: tabId } });
    },
    [url, await tabIdOf(serviceWorker, url)] as const,
  );

  await expect
    .poll(async () => {
      await page.click('#probe');
      return (await clicks(page)).at(-1);
    })
    .toEqual({ id: 'probe', prevented: true });
  expect(page.url()).toBe(url);
});
