import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0] as chrome.tabs.Tab;

/** Chrome sends this event once, when the browser starts. */
const fireStartup = () =>
  (browser.runtime.onStartup as unknown as { trigger(): Promise<void> }).trigger();

/** Pins the tab of this URL, as the user does with the shortcut. */
async function pin(url: string) {
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', await tabOf(url));
  await settle();
}

/**
 * Chrome quits and starts again, then restores one window with these tabs.
 * Returns the panel of the restored window, with the state it received at start.
 */
async function restartBrowser(restored: string[]) {
  stopWorker();
  await fakeChrome.restartBrowser();
  const windowId = await fakeChrome.openWindow(restored);
  await startWorker();
  await fireStartup();
  const panel = connectPanel(windowId);
  await settle();
  return { windowId, panel };
}

/** What the panel shows for each item: its URL and the URL of its live tab, if any. */
const links = (panel: ReturnType<typeof connectPanel>) =>
  panel.latest()?.items.map((item) => [item.url, item.live?.tabId]);

it('links a restored tab to the Pinned Tab with the same URL after Chrome restarted', async () => {
  await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  await pin('https://a.test/');

  const { panel } = await restartBrowser(['https://b.test/', 'https://a.test/']);

  const restored = await tabOf('https://a.test/');
  expect(links(panel)).toEqual([['https://a.test/', restored.id]]);
  expect(panel.latest()?.unpinnedTabs.map((tab) => tab.url)).toEqual(['https://b.test/']);
});

it('leaves an Item at rest when no restored tab has its URL', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  await pin('https://a.test/');

  const { panel } = await restartBrowser(['https://other.test/']);

  expect(links(panel)).toEqual([['https://a.test/', undefined]]);
  expect(panel.latest()?.unpinnedTabs.map((tab) => tab.url)).toEqual(['https://other.test/']);
});

it('matches the whole URL, not a prefix of it', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  await pin('https://a.test/');

  const { panel } = await restartBrowser(['https://a.test/inbox', 'https://a.test/#top']);

  expect(links(panel)).toEqual([['https://a.test/', undefined]]);
});

it('links one of two restored tabs with the same URL: the first in the tab strip', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  await pin('https://a.test/');

  const { panel } = await restartBrowser(['https://a.test/', 'https://b.test/', 'https://a.test/']);

  const [first, , second] = await browser.tabs.query({});
  expect(links(panel)).toEqual([['https://a.test/', first?.id]]);
  expect(panel.latest()?.unpinnedTabs.map((tab) => tab.id)).toEqual([
    (await tabOf('https://b.test/')).id,
    second?.id,
  ]);
});

it('links the tab of the first window when two windows restore the same URL', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  await pin('https://a.test/');
  stopWorker();
  await fakeChrome.restartBrowser();
  const first = await fakeChrome.openWindow(['https://a.test/']);
  await fakeChrome.openWindow(['https://a.test/']);
  await startWorker();
  await fireStartup();
  const panel = connectPanel(first);
  await settle();

  const [firstTab] = await browser.tabs.query({ windowId: first });
  expect(links(panel)).toEqual([['https://a.test/', firstTab?.id]]);
});

it('gives one tab to one Item only', async () => {
  await fakeChrome.openWindow(['https://a.test/', 'https://a.test/']);
  for (const tab of await browser.tabs.query({}))
    await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', tab);
  await settle();

  const { panel } = await restartBrowser(['https://a.test/']);

  expect(panel.latest()?.items.filter((item) => item.live)).toHaveLength(1);
});

it('keeps every link, and links nothing else, after the service worker restarted', async () => {
  const windowId = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  await pin('https://a.test/');
  await pin('https://b.test/');
  const kept = (await tabOf('https://a.test/')).id;
  // The user closes the live tab of B, then opens B again as a plain tab.
  await browser.tabs.remove((await tabOf('https://b.test/')).id as number);
  await browser.tabs.create({ windowId, url: 'https://b.test/' });
  stopWorker();

  await startWorker();
  const panel = connectPanel(windowId);
  await settle();

  expect(links(panel)).toEqual([
    ['https://a.test/', kept],
    ['https://b.test/', undefined],
  ]);
  expect(panel.latest()?.unpinnedTabs.map((tab) => tab.url)).toEqual(['https://b.test/']);
});

it('links the open tabs when the worker starts with no link at all', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  await pin('https://a.test/');
  stopWorker();
  await fakeChrome.restartBrowser();
  const windowId = await fakeChrome.openWindow(['https://a.test/']);

  await startWorker();
  const panel = connectPanel(windowId);
  await settle();

  expect(links(panel)).toEqual([['https://a.test/', (await tabOf('https://a.test/')).id]]);
});

it('does not link a tab that opens after the restart', async () => {
  const { panel, windowId } = await restartBrowser([]);
  await fakeChrome.openWindow(['https://a.test/']);
  await pin('https://a.test/');
  await browser.tabs.remove((await tabOf('https://a.test/')).id as number);
  await settle();

  await browser.tabs.create({ windowId, url: 'https://a.test/' });
  await settle();

  expect(links(panel)).toEqual([['https://a.test/', undefined]]);
});

it('links a restored tab that has not loaded yet, by its pending URL', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  await pin('https://a.test/');
  stopWorker();
  await fakeChrome.restartBrowser();
  const windowId = await fakeChrome.openWindow(['https://a.test/']);
  const tab = await tabOf('https://a.test/');
  await fakeChrome.patchTab(tab.id as number, {
    url: '',
    pendingUrl: 'https://a.test/',
    status: 'loading',
  });

  await startWorker();
  await fireStartup();
  const panel = connectPanel(windowId);
  await settle();

  expect(links(panel)).toEqual([['https://a.test/', tab.id]]);
});

it('links a restored tab whose URL arrives after the start', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  await pin('https://a.test/');
  stopWorker();
  await fakeChrome.restartBrowser();
  const windowId = await fakeChrome.openWindow(['https://a.test/']);
  const tab = await tabOf('https://a.test/');
  await fakeChrome.patchTab(tab.id as number, { url: '', status: 'loading' });
  await startWorker();
  await fireStartup();
  const panel = connectPanel(windowId);
  await settle();
  expect(links(panel)).toEqual([['https://a.test/', undefined]]);

  await fakeChrome.patchTab(tab.id as number, { url: 'https://a.test/', status: 'complete' });
  await settle();

  expect(links(panel)).toEqual([['https://a.test/', tab.id]]);
});

it('does not move a live tab that already belongs to an Item', async () => {
  const { panel, windowId } = await restartBrowser([]);
  const early = await browser.tabs.create({ windowId, url: 'https://a.test/' });
  const late = await browser.tabs.create({ windowId, url: 'https://a.test/' });
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', late);
  await settle();

  await fireStartup();
  await settle();

  expect(links(panel)).toEqual([['https://a.test/', late.id]]);
  expect(panel.latest()?.unpinnedTabs.map((tab) => tab.id)).toEqual([early.id]);
});
