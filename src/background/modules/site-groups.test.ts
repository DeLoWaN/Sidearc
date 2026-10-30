import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';
import type { SiteGroupView } from '../../shared/types';

let windowId: number;
let opener: number;

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
  windowId = await fakeChrome.openWindow(['https://docs.test/start']);
  opener = await tabId('https://docs.test/start');
});

async function tabId(url: string) {
  return (await browser.tabs.query({ url }))[0]?.id as number;
}

/** What a middle click does: a new tab opens behind the current one, with the opener set. */
async function openFrom(url: string, from = opener) {
  const tab = await browser.tabs.create({ url, windowId, active: false, openerTabId: from });
  await settle();
  return tab.id as number;
}

/** The site groups that a panel receives now. */
async function siteGroups(): Promise<SiteGroupView[]> {
  const panel = connectPanel(windowId);
  await settle();
  return panel.latest()?.siteGroups ?? [];
}

/** The URLs of the tabs of each site group, in the order that the panel gets them. */
async function groupedUrls() {
  const urls = new Map((await browser.tabs.query({})).map((tab) => [tab.id, tab.url]));
  return (await siteGroups()).map((group) => group.tabIds.map((id) => urls.get(id)));
}

it('groups a tab with its opener when both are on the same site', async () => {
  const child = await openFrom('https://docs.test/next');

  expect(await siteGroups()).toEqual([
    { id: expect.any(String), host: 'docs.test', tabIds: [opener, child], collapsed: false },
  ]);
});

it('groups the tab once its URL is known, when the URL is empty at creation', async () => {
  const child = await openFrom('about:blank');
  expect(await siteGroups()).toEqual([]);

  await fakeChrome.patchTab(child, { url: 'https://docs.test/loaded' });
  await settle();

  expect((await siteGroups())[0]?.tabIds).toEqual([opener, child]);
});

it('does not group a tab that opens on another site', async () => {
  await openFrom('https://other.test/');

  expect(await siteGroups()).toEqual([]);
});

it('does not group a tab that opens on a page that is not on the web, even when it reaches the site later', async () => {
  const child = await openFrom('chrome://settings/');

  await fakeChrome.patchTab(child, { url: 'https://docs.test/later' });
  await settle();

  expect(await siteGroups()).toEqual([]);
});

it('does not group a tab that has no opener', async () => {
  await browser.tabs.create({ url: 'https://docs.test/alone', windowId, active: false });
  await settle();

  expect(await siteGroups()).toEqual([]);
});

it('treats www. and the bare host as one site, in any letter case', async () => {
  await openFrom('https://WWW.Docs.test/next');

  expect(await groupedUrls()).toEqual([['https://docs.test/start', 'https://WWW.Docs.test/next']]);
});

it('treats another subdomain as another site', async () => {
  await openFrom('https://wiki.docs.test/');

  expect(await siteGroups()).toEqual([]);
});

it('adds a third tab to the group of its opener', async () => {
  const first = await openFrom('https://docs.test/one');
  const second = await openFrom('https://docs.test/two');
  const third = await openFrom('https://docs.test/three', first);

  const groups = await siteGroups();
  expect(groups).toHaveLength(1);
  expect(groups[0]?.tabIds).toEqual([opener, first, second, third]);
});

it('never puts a tab in two groups', async () => {
  const child = await openFrom('https://docs.test/child');
  const sibling = await openFrom('https://wiki.test/page');
  await openFrom('https://wiki.test/other', sibling);

  const groups = await siteGroups();
  expect(groups.map((group) => group.host)).toEqual(['docs.test', 'wiki.test']);
  const members = groups.flatMap((group) => group.tabIds);
  expect(new Set(members).size).toBe(members.length);
  expect(groups[0]?.tabIds).toEqual([opener, child]);
});

// --- who can be in a group

/** Presses the "pin current tab" shortcut while this tab is the current one: the tab becomes a live tab. */
async function pinTab(id: number) {
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', await browser.tabs.get(id));
  await settle();
}

/** Puts the tabs in a Chrome Tab group. */
async function chromeGroup(...ids: number[]) {
  await browser.tabs.group({ tabIds: ids as [number, ...number[]] });
  await settle();
}

it('does not group a tab with an opener that is the live tab of a Pinned Tab', async () => {
  await pinTab(opener);

  await openFrom('https://docs.test/next');

  expect(await siteGroups()).toEqual([]);
});

it('does not group a tab with an opener that is in a Chrome Tab group', async () => {
  await chromeGroup(opener);

  await openFrom('https://docs.test/next');

  expect(await siteGroups()).toEqual([]);
});

it('does not group a tab that reaches the site of its opener after it opened on another site', async () => {
  const child = await openFrom('https://other.test/');

  await fakeChrome.patchTab(child, { url: 'https://docs.test/later' });
  await settle();

  expect(await siteGroups()).toEqual([]);
});

it('keeps a member that navigates to another site', async () => {
  const child = await openFrom('https://docs.test/next');

  await fakeChrome.patchTab(child, { url: 'https://other.test/' });
  await settle();

  expect((await siteGroups())[0]?.tabIds).toEqual([opener, child]);
});

// --- how a group ends

it('keeps the group while 2 tabs are left, and removes it when a member closes at 2 tabs', async () => {
  const first = await openFrom('https://docs.test/one');
  const second = await openFrom('https://docs.test/two');

  await browser.tabs.remove(second);
  await settle();
  expect((await siteGroups())[0]?.tabIds).toEqual([opener, first]);

  await browser.tabs.remove(first);
  await settle();
  expect(await siteGroups()).toEqual([]);
});

it('removes a tab from its group when the tab becomes the live tab of a Pinned Tab', async () => {
  const first = await openFrom('https://docs.test/one');
  const second = await openFrom('https://docs.test/two');

  await pinTab(first);

  expect((await siteGroups())[0]?.tabIds).toEqual([opener, second]);
});

it('removes a tab from its group when it joins a Chrome Tab group', async () => {
  const first = await openFrom('https://docs.test/one');
  const second = await openFrom('https://docs.test/two');

  await chromeGroup(second);

  expect((await siteGroups())[0]?.tabIds).toEqual([opener, first]);
});

it('forgets a tab that a Pinned Tab took, also after the worker restarted', async () => {
  const child = await openFrom('https://docs.test/one');
  stopWorker();
  await startWorker();

  await pinTab(child);

  expect(await siteGroups()).toEqual([]);
});

// --- commands

it('keeps the group and its collapsed state after the service worker restarts', async () => {
  const child = await openFrom('https://docs.test/next');
  const [group] = await siteGroups();
  connectPanel(windowId).send({ type: 'site-group/toggle', groupId: group?.id as string });
  await settle();

  stopWorker();
  await startWorker();

  expect(await siteGroups()).toEqual([
    { id: group?.id, host: 'docs.test', tabIds: [opener, child], collapsed: true },
  ]);
});

it('expands a collapsed group when the user toggles it again', async () => {
  await openFrom('https://docs.test/next');
  const [group] = await siteGroups();
  const panel = connectPanel(windowId);

  panel.send({ type: 'site-group/toggle', groupId: group?.id as string });
  await settle();
  expect(panel.latest()?.siteGroups[0]?.collapsed).toBe(true);
  panel.send({ type: 'site-group/toggle', groupId: group?.id as string });
  await settle();

  expect(panel.latest()?.siteGroups[0]?.collapsed).toBe(false);
});

it('dissolves the group on "ungroup" and keeps its tabs open', async () => {
  await openFrom('https://docs.test/next');
  const [group] = await siteGroups();

  connectPanel(windowId).send({ type: 'site-group/ungroup', groupId: group?.id as string });
  await settle();

  expect(await siteGroups()).toEqual([]);
  expect(await browser.tabs.query({})).toHaveLength(2);
});

it('takes one tab out of its group on "remove-tab"', async () => {
  const first = await openFrom('https://docs.test/one');
  const second = await openFrom('https://docs.test/two');

  connectPanel(windowId).send({ type: 'site-group/remove-tab', tabId: first });
  await settle();

  expect((await siteGroups())[0]?.tabIds).toEqual([opener, second]);
});

it('removes the group when "remove-tab" leaves it with one tab', async () => {
  const child = await openFrom('https://docs.test/next');

  connectPanel(windowId).send({ type: 'site-group/remove-tab', tabId: child });
  await settle();

  expect(await siteGroups()).toEqual([]);
});

it('does not group the tab again when its page changes after the user removed it', async () => {
  const child = await openFrom('https://docs.test/next');
  connectPanel(windowId).send({ type: 'site-group/remove-tab', tabId: child });
  await settle();

  await fakeChrome.patchTab(child, { url: 'https://docs.test/other-page' });
  await settle();

  expect(await siteGroups()).toEqual([]);
});

// --- the setting

it('forms no group when the setting "groupBySite" is off, and keeps the groups that exist', async () => {
  const child = await openFrom('https://docs.test/next');

  await browser.storage.local.set({ settings: { groupBySite: false } });
  await openFrom('https://docs.test/third');
  const lateOpener = await openFrom('https://wiki.test/a');
  await openFrom('https://wiki.test/b', lateOpener);

  const groups = await siteGroups();
  expect(groups).toHaveLength(1);
  expect(groups[0]?.tabIds).toEqual([opener, child]);
});

// --- windows

it('keeps a member in its group when Tab Handoff moves it to another window', async () => {
  const child = await openFrom('https://docs.test/next');
  const other = await fakeChrome.openWindow(['https://other.test/']);

  connectPanel(other).send({ type: 'tab/activate', tabId: child });
  await settle();

  expect((await browser.tabs.get(child)).windowId).toBe(other);
  expect((await siteGroups())[0]?.tabIds).toEqual([opener, child]);
});

it('lists the members in tab strip order, whatever order they joined in', async () => {
  const first = await openFrom('https://docs.test/one');
  const second = await openFrom('https://docs.test/two');
  await browser.tabs.move(second, { index: 0 });
  await settle();

  expect((await siteGroups())[0]?.tabIds).toEqual([second, opener, first]);
});
