import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';

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
