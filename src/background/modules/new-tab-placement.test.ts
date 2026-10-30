import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';

let windowId: number;

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
  windowId = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/', 'https://c.test/']);
});

/** The URLs of the tabs of the window, in tab strip order. */
async function stripUrls() {
  return (await browser.tabs.query({ windowId })).map((tab) => tab.url);
}

/** What Ctrl+T does: a New Tab page opens, with no opener. */
async function openNewTab(url = 'chrome://newtab/') {
  const tab = await browser.tabs.create({ windowId, url });
  await settle();
  return tab;
}

const saveSettings = (request: unknown) =>
  browser.runtime.sendMessage({ rpc: 'settings/save', request });

it('moves a new tab that the user opens to the start of the tab strip', async () => {
  await openNewTab();

  expect(await stripUrls()).toEqual([
    'chrome://newtab/',
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
  ]);
});

it('asks Chrome for index 0 so that Chrome keeps its own pinned tabs first', async () => {
  const move = vi.spyOn(browser.tabs, 'move');

  const tab = await openNewTab();

  expect(move).toHaveBeenCalledExactlyOnceWith(tab.id, { index: 0 });
});

it('leaves a tab that a link opens where Chrome put it, next to its opener', async () => {
  const opener = (await browser.tabs.query({ url: 'https://a.test/' }))[0]?.id;

  await browser.tabs.create({ windowId, url: 'chrome://newtab/', openerTabId: opener });
  await settle();

  expect((await stripUrls())[1]).toBe('chrome://newtab/');
});

it('leaves a tab with a real address where Chrome put it', async () => {
  await openNewTab('https://restored.test/');

  expect((await stripUrls()).at(-1)).toBe('https://restored.test/');
});

it('leaves the first tab of a new window alone', async () => {
  const move = vi.spyOn(browser.tabs, 'move');

  await fakeChrome.openWindow(['chrome://newtab/']);
  await settle();

  expect(move).not.toHaveBeenCalled();
});

it('moves the New Tab page by the address that Chrome reports while the page loads', async () => {
  const move = vi.spyOn(browser.tabs, 'move');
  const tab = await browser.tabs.create({ windowId, url: 'https://a.test/' });
  move.mockClear();

  for (const pendingUrl of ['chrome://newtab/', 'chrome://new-tab-page/']) {
    await fakeChrome.events.tabs.onCreated.trigger({ ...tab, url: '', pendingUrl });
    await settle();
  }
  for (const url of ['', 'about:blank']) {
    await fakeChrome.events.tabs.onCreated.trigger({ ...tab, url });
    await settle();
  }

  expect(move).toHaveBeenCalledTimes(4);
  expect(move).toHaveBeenCalledWith(tab.id, { index: 0 });
});

it('leaves a loading tab alone when its address is a real page', async () => {
  const move = vi.spyOn(browser.tabs, 'move');
  const tab = await browser.tabs.create({ windowId, url: 'https://a.test/' });
  move.mockClear();

  await fakeChrome.events.tabs.onCreated.trigger({
    ...tab,
    url: '',
    pendingUrl: 'https://restored.test/',
  });
  await settle();

  expect(move).not.toHaveBeenCalled();
});

it('leaves the tab where Chrome put it when the setting is off', async () => {
  await saveSettings({ newTabsOnTop: false });

  await openNewTab();

  expect((await stripUrls()).at(-1)).toBe('chrome://newtab/');
});

it('applies a change of the setting at once, in both directions', async () => {
  await saveSettings({ newTabsOnTop: false });
  await openNewTab();
  await saveSettings({ newTabsOnTop: true });
  await openNewTab();

  expect((await stripUrls()).slice(0, 2)).toEqual(['chrome://newtab/', 'https://a.test/']);
  expect((await stripUrls()).at(-1)).toBe('chrome://newtab/');
});

it('does not move the blank tab that Clear opens in a window it empties', async () => {
  const panel = connectPanel(windowId);
  const move = vi.spyOn(browser.tabs, 'move');

  panel.send({ type: 'tab/clear' });
  await settle();

  expect(move).not.toHaveBeenCalled();
  expect(await stripUrls()).toEqual(['chrome://newtab/']);
});

it('moves a New Tab page that the user opens after a Clear', async () => {
  const panel = connectPanel(windowId);
  panel.send({ type: 'tab/clear' });
  await settle();
  await browser.tabs.create({ windowId, url: 'https://x.test/' });
  const move = vi.spyOn(browser.tabs, 'move');

  await openNewTab();

  expect(move).toHaveBeenCalledOnce();
});

// --- what real Chrome sends

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Makes the next `count` calls of `tabs.move` fail, as Chrome does while the user drags a tab. */
function refuseMoves(count: number) {
  const original = browser.tabs.move.bind(browser.tabs);
  let left = count;
  return vi.spyOn(browser.tabs, 'move').mockImplementation(async (...args) => {
    if (left-- > 0)
      throw new Error('Tabs cannot be edited right now (user may be dragging a tab).');
    return original(...args);
  });
}

/** The tab that is the last of the window, and what Chrome reports for it when it fires `tabs.onCreated`. */
async function reportCreated(report: Partial<chrome.tabs.Tab>) {
  const tab = await browser.tabs.create({ windowId, url: 'https://loading.test/' });
  await settle();
  await fakeChrome.events.tabs.onCreated.trigger({ ...tab, ...report });
  await settle();
  return tab.id as number;
}

const firstUrl = async () => (await stripUrls())[0];

it('moves the tab that Chrome reports with an empty address and the pending address chrome://newtab/', async () => {
  await reportCreated({ url: '', pendingUrl: 'chrome://newtab/', status: 'loading' });

  expect(await firstUrl()).toBe('https://loading.test/');
});

it('moves a New Tab page that a search engine other than Google serves', async () => {
  await reportCreated({ url: '', pendingUrl: 'chrome://new-tab-page-third-party/' });

  expect(await firstUrl()).toBe('https://loading.test/');
});

it('moves a New Tab page that an extension replaced, when Chrome first asked for chrome://newtab/', async () => {
  await reportCreated({
    url: 'chrome-extension://other/newtab.html',
    pendingUrl: 'chrome://newtab/',
  });

  expect(await firstUrl()).toBe('https://loading.test/');
});

it('leaves an extension page that nobody asked for as a New Tab page', async () => {
  await reportCreated({ url: 'chrome-extension://other/page.html', pendingUrl: '' });

  expect(await firstUrl()).toBe('https://a.test/');
});

it('leaves a page of Sidearc itself that loads in a New Tab page', async () => {
  const move = refuseMoves(10);
  const id = await reportCreated({ url: '', pendingUrl: 'chrome://newtab/' });

  await fakeChrome.patchTab(id, { url: browser.runtime.getURL('/options.html') });
  await sleep(150);

  expect(move).toHaveBeenCalledOnce();
  expect(await firstUrl()).toBe('https://a.test/');
});

it('moves a New Tab page that an extension fills in after Chrome refused the first move', async () => {
  refuseMoves(1);
  const id = await reportCreated({ url: '', pendingUrl: 'chrome://newtab/' });

  await fakeChrome.patchTab(id, { url: 'chrome-extension://other/newtab.html' });
  await sleep(150);

  expect(await firstUrl()).toBe('chrome-extension://other/newtab.html');
});

it('moves a New Tab page whose opener is the tab that was active a moment ago', async () => {
  const active = (await browser.tabs.query({ windowId, active: true }))[0]?.id;

  await browser.tabs.create({ windowId, url: 'chrome://newtab/', openerTabId: active });
  await settle();

  expect(await firstUrl()).toBe('chrome://newtab/');
});

it('leaves a New Tab page whose opener is another tab than the active one', async () => {
  const first = (await browser.tabs.query({ windowId, index: 0 }))[0]?.id;

  await browser.tabs.create({ windowId, url: 'chrome://newtab/', openerTabId: first });
  await settle();

  expect(await firstUrl()).toBe('https://a.test/');
});

it('still knows the active tab after Chrome stopped the worker and a new tab woke it', async () => {
  const active = (await browser.tabs.query({ windowId, active: true }))[0]?.id;
  const first = (await browser.tabs.query({ windowId, index: 0 }))[0]?.id;
  stopWorker();
  await startWorker();

  await browser.tabs.create({ windowId, url: 'chrome://newtab/', openerTabId: first });
  await settle();
  expect(await firstUrl()).toBe('https://a.test/');
  await browser.tabs.create({ windowId, url: 'chrome://newtab/', openerTabId: active });
  await settle();

  expect(await firstUrl()).toBe('chrome://newtab/');
});

it('accepts any opener of a New Tab page when the worker knows no active tab', async () => {
  const first = (await browser.tabs.query({ windowId, index: 0 }))[0]?.id;
  await browser.storage.session.clear();

  await browser.tabs.create({ windowId, url: 'chrome://newtab/', openerTabId: first });
  await settle();

  expect(await firstUrl()).toBe('chrome://newtab/');
});

it('looks again when the first update of a blank tab that has an opener shows a New Tab page', async () => {
  const active = (await browser.tabs.query({ windowId, active: true }))[0]?.id;
  const tab = await browser.tabs.create({ windowId, url: 'about:blank', openerTabId: active });
  await settle();
  expect(await firstUrl()).toBe('https://a.test/');

  await fakeChrome.patchTab(tab.id as number, {
    url: 'chrome://new-tab-page/',
    status: 'complete',
  });
  await settle();

  expect(await firstUrl()).toBe('chrome://new-tab-page/');
});

it('leaves a blank tab that has an opener when its first update shows a real page', async () => {
  const active = (await browser.tabs.query({ windowId, active: true }))[0]?.id;
  const tab = await browser.tabs.create({ windowId, url: 'about:blank', openerTabId: active });
  await settle();

  await fakeChrome.patchTab(tab.id as number, { url: 'https://popup.test/', status: 'complete' });
  await settle();

  expect(await firstUrl()).toBe('https://a.test/');
});

it('does not spend a try on the activation of the tab while it waits for the next try', async () => {
  const move = refuseMoves(1);
  const tab = await openNewTab();

  await fakeChrome.events.tabs.onActivated.trigger({ tabId: tab.id as number, windowId });
  await settle();
  expect(move).toHaveBeenCalledOnce();
  await sleep(150);

  expect(move).toHaveBeenCalledTimes(2);
  expect(await firstUrl()).toBe('chrome://newtab/');
});

it('tries the move again after 100 ms when Chrome refuses it', async () => {
  const move = refuseMoves(1);

  await openNewTab();
  expect(await firstUrl()).toBe('https://a.test/');
  await sleep(150);

  expect(await firstUrl()).toBe('chrome://newtab/');
  expect(move).toHaveBeenCalledTimes(2);
});

it('tries a third time after 400 ms more, and then stops', async () => {
  const move = refuseMoves(10);

  await openNewTab();
  await sleep(150);
  expect(move).toHaveBeenCalledTimes(2);
  await sleep(500);
  await sleep(100);

  expect(move).toHaveBeenCalledTimes(3);
  expect(await firstUrl()).toBe('https://a.test/');
});

it('never moves a tab twice', async () => {
  const move = vi.spyOn(browser.tabs, 'move');
  const tab = await openNewTab();

  await fakeChrome.patchTab(tab.id as number, {
    url: 'chrome://new-tab-page/',
    status: 'complete',
  });
  await fakeChrome.events.tabs.onActivated.trigger({ tabId: tab.id as number, windowId });
  await sleep(150);

  expect(move).toHaveBeenCalledOnce();
});

it('leaves the tab where the user put it after the move', async () => {
  const tab = await openNewTab();
  await browser.tabs.move(tab.id as number, { index: 2 });

  await fakeChrome.patchTab(tab.id as number, {
    url: 'chrome://new-tab-page/',
    status: 'complete',
  });
  await settle();

  expect((await stripUrls())[2]).toBe('chrome://new-tab-page/');
});

it('leaves a tab alone in a window that is not a normal window', async () => {
  vi.spyOn(browser.windows, 'get').mockResolvedValue({ type: 'popup' } as never);
  const move = vi.spyOn(browser.tabs, 'move');

  await openNewTab();

  expect(move).not.toHaveBeenCalled();
});

// --- diagnostics

const diagnostics = () =>
  browser.runtime.sendMessage({ rpc: 'diagnostics/get', request: null }) as Promise<
    import('../../shared/protocol').PlacementLogEntry[]
  >;

/** The entries of one tab. */
const diagnosticsOf = async (tabId: number) =>
  (await diagnostics()).filter((entry) => entry.tabId === tabId);

it('logs what Chrome sent for a tab and the move that followed', async () => {
  const tab = await openNewTab();

  expect(await diagnosticsOf(tab.id as number)).toEqual([
    expect.objectContaining({
      event: 'created',
      tabId: tab.id,
      windowId,
      index: 3,
      openerTabId: null,
      url: 'chrome://newtab/',
      pendingUrl: '',
      active: false,
      decision: 'move',
      moveResult: 'moved',
      time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }),
  ]);
});

it('logs why a tab stays where it is', async () => {
  const tab = await browser.tabs.create({ windowId, url: 'https://link.test/', openerTabId: 1 });
  await settle();

  expect(await diagnosticsOf(tab.id as number)).toEqual([
    expect.objectContaining({ decision: 'skip', reason: expect.stringMatching(/real page/i) }),
  ]);
});

it('logs the error of a refused move and the retry that follows', async () => {
  refuseMoves(1);

  const tab = await openNewTab();
  await sleep(150);

  expect(await diagnosticsOf(tab.id as number)).toEqual([
    expect.objectContaining({
      event: 'created',
      decision: 'move',
      moveResult: 'error: Tabs cannot be edited right now (user may be dragging a tab).',
    }),
    expect.objectContaining({ event: 'retry', decision: 'move', moveResult: 'moved' }),
  ]);
});

it('keeps the last 40 entries, the oldest first', async () => {
  for (let i = 0; i < 45; i++)
    await browser.tabs.create({ windowId, url: `https://link.test/${i}`, openerTabId: 1 });
  await settle();

  const log = await diagnostics();
  expect(log).toHaveLength(40);
  expect(log[0]?.url).toBe('https://link.test/5');
  expect(log.at(-1)?.url).toBe('https://link.test/44');
});
