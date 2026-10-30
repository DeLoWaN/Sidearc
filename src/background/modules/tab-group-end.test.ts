import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { settle, startWorker } from '../../../tests/support/worker';

let windowId: number;
let groupId: number;
let opener: number;

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
  windowId = await fakeChrome.openWindow([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
    'https://x.test/',
  ]);
  const [a, b] = await Promise.all([tabId('https://a.test/'), tabId('https://b.test/')]);
  opener = a;
  groupId = await browser.tabs.group({ tabIds: [a, b] });
  await settle();
});

const tabId = async (url: string) => (await browser.tabs.query({ url }))[0]?.id as number;

/** The URLs of the tabs of the window, in tab strip order, each with the group of the tab. */
async function strip() {
  return (await browser.tabs.query({ windowId })).map((tab) => [
    tab.url,
    tab.groupId === groupId ? 'group' : 'none',
  ]);
}

/** What a middle click does: a new tab opens behind the current one. Chrome puts it next to the opener. */
async function openFrom(url: string, from = opener) {
  const tab = await browser.tabs.create({ url, windowId, active: false, openerTabId: from });
  await settle();
  return tab.id as number;
}

it('puts a tab that opens from a tab of a Tab group at the end of the group, inside the group', async () => {
  await openFrom('https://new.test/');

  expect(await strip()).toEqual([
    ['https://a.test/', 'group'],
    ['https://b.test/', 'group'],
    ['https://new.test/', 'group'],
    ['https://c.test/', 'none'],
    ['https://x.test/', 'none'],
  ]);
});

it('puts the tab in the group when the move took it out of the group', async () => {
  const original = browser.tabs.move.bind(browser.tabs);
  vi.spyOn(browser.tabs, 'move').mockImplementation(async (ids, properties) => {
    const moved = await original(ids as never, properties);
    await browser.tabs.ungroup(ids as never);
    return moved;
  });

  await openFrom('https://new.test/');

  expect((await strip()).slice(0, 3)).toEqual([
    ['https://a.test/', 'group'],
    ['https://b.test/', 'group'],
    ['https://new.test/', 'group'],
  ]);
});

it('leaves a tab where it is when its opener is in no Tab group', async () => {
  const c = await tabId('https://c.test/');

  await openFrom('https://new.test/', c);

  expect((await strip()).map(([url]) => url)).toEqual([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
    'https://new.test/',
    'https://x.test/',
  ]);
});

it('leaves a tab without an opener where it is', async () => {
  await browser.tabs.create({ url: 'https://new.test/', windowId, active: false });
  await settle();

  expect((await strip()).at(-1)).toEqual(['https://new.test/', 'none']);
});

it('moves the tab once, and leaves it where the user puts it later', async () => {
  const move = vi.spyOn(browser.tabs, 'move');
  const tab = await openFrom('https://new.test/');
  expect(move).toHaveBeenCalledExactlyOnceWith(tab, { index: 2 });

  await fakeChrome.patchTab(tab, { url: 'https://new.test/2' });
  await browser.tabs.move(tab, { index: 0 });
  await settle();

  expect((await strip())[0]?.[0]).toBe('https://new.test/2');
});
