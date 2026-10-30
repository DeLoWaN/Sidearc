import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';

let windowId: number;
let opener: number;

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
  windowId = await fakeChrome.openWindow(['https://opener.test/']);
  opener = await tabId('https://opener.test/');
});

async function tabId(url: string) {
  return (await browser.tabs.query({ url }))[0]?.id as number;
}

/** What a middle click does: a new tab opens behind the current one, with the opener set. */
async function openInBackground(url: string) {
  await browser.tabs.create({ url, windowId, active: false, openerTabId: opener });
  await settle();
}

/** The URLs that the panel shows as not visited yet. */
async function unvisitedUrls() {
  const panel = connectPanel(windowId);
  await settle();
  return panel
    .latest()
    ?.unpinnedTabs.filter((tab) => tab.unvisited)
    .map((tab) => tab.url);
}

it('marks a tab that opens in the background from another tab', async () => {
  await openInBackground('https://link.test/');

  expect(await unvisitedUrls()).toEqual(['https://link.test/']);
});

it('does not mark a tab that opens in front of the user', async () => {
  await browser.tabs.create({ url: 'https://front.test/', windowId, openerTabId: opener });
  await settle();

  expect(await unvisitedUrls()).toEqual([]);
});

it('does not mark a background tab that has no opener', async () => {
  await browser.tabs.create({ url: 'https://restored.test/', windowId, active: false });
  await settle();

  expect(await unvisitedUrls()).toEqual([]);
});

it('clears the mark when the user shows the tab', async () => {
  await openInBackground('https://link.test/');

  await browser.tabs.update(await tabId('https://link.test/'), { active: true });
  await settle();

  expect(await unvisitedUrls()).toEqual([]);
});

it('clears the mark when Chrome reports that the tab became active', async () => {
  await openInBackground('https://link.test/');

  await fakeChrome.patchTab(await tabId('https://link.test/'), { active: true });
  await settle();

  expect(await unvisitedUrls()).toEqual([]);
});

it('keeps the mark on the other background tabs', async () => {
  await openInBackground('https://one.test/');
  await openInBackground('https://two.test/');

  await browser.tabs.update(await tabId('https://one.test/'), { active: true });
  await settle();

  expect(await unvisitedUrls()).toEqual(['https://two.test/']);
});

it('drops the record of a tab that closes', async () => {
  await openInBackground('https://link.test/');
  const closed = await tabId('https://link.test/');

  await browser.tabs.remove(closed);
  await settle();

  const stored = await browser.storage.session.get(null);
  expect(Object.values(stored).flat()).not.toContain(closed);
});

it('keeps the mark after the service worker restarts', async () => {
  await openInBackground('https://link.test/');

  stopWorker();
  await startWorker();

  expect(await unvisitedUrls()).toEqual(['https://link.test/']);
});

it('keeps the mark when the tab moves to another window', async () => {
  await openInBackground('https://link.test/');
  const other = await fakeChrome.openWindow(['https://other.test/']);

  await browser.tabs.move(await tabId('https://link.test/'), { windowId: other, index: -1 });
  await settle();

  expect(await unvisitedUrls()).toEqual(['https://link.test/']);
});

it('marks nothing after Chrome restarts', async () => {
  await openInBackground('https://link.test/');

  await fakeChrome.restartBrowser();
  await startWorker();
  windowId = await fakeChrome.openWindow(['https://link.test/']);

  expect(await unvisitedUrls()).toEqual([]);
});
