import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeChrome } from '../support/fake-chrome';

beforeEach(() => fakeChrome.reset());

describe('fake chrome', () => {
  it('moves a tab to another window and fires detach/attach', async () => {
    const w1 = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
    const w2 = await fakeChrome.openWindow(['https://c.test/']);
    const [a] = await browser.tabs.query({ url: 'https://a.test/' });
    const detached = vi.fn();
    const attached = vi.fn();
    browser.tabs.onDetached.addListener(detached);
    browser.tabs.onAttached.addListener(attached);
    await browser.tabs.move(a!.id!, { windowId: w2, index: -1 });
    expect(detached).toHaveBeenCalledWith(a!.id, { oldWindowId: w1, oldPosition: 0 });
    expect(attached).toHaveBeenCalledWith(a!.id, { newWindowId: w2, newPosition: 1 });
    const inW2 = await browser.tabs.query({ windowId: w2 });
    expect(inW2.map((t) => t.url)).toEqual(['https://c.test/', 'https://a.test/']);
    expect((await browser.tabs.query({ windowId: w1 })).map((t) => t.index)).toEqual([0]);
  });

  it('closes a window when its last tab leaves', async () => {
    await fakeChrome.openWindow(['https://a.test/']);
    const w2 = await fakeChrome.openWindow(['https://c.test/']);
    const [c] = await browser.tabs.query({ url: 'https://c.test/' });
    await browser.tabs.move(c!.id!, { windowId: 1, index: 0 });
    expect((await browser.windows.getAll()).map((w) => w.id)).toEqual([1]);
    expect(w2).toBe(2);
  });

  it('groups tabs and removes an empty group', async () => {
    await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
    const tabs = await browser.tabs.query({});
    const ids = tabs.map((t) => t.id as number) as [number, ...number[]];
    const gid = (await browser.tabs.group({ tabIds: ids })) as unknown as number;
    await browser.tabGroups.update(gid, { title: 'G', collapsed: true });
    expect(await browser.tabGroups.query({})).toMatchObject([
      { id: gid, title: 'G', collapsed: true },
    ]);
    await browser.tabs.ungroup(ids);
    expect(await browser.tabGroups.query({})).toEqual([]);
  });

  it('moves a whole Tab group to an index of the final strip, also into another window', async () => {
    const w1 = await fakeChrome.openWindow([
      'https://a.test/',
      'https://b.test/',
      'https://c.test/',
    ]);
    const w2 = await fakeChrome.openWindow(['https://x.test/']);
    const [a, b] = await browser.tabs.query({ windowId: w1 });
    const gid = (await browser.tabs.group({ tabIds: [a!.id!, b!.id!] })) as unknown as number;
    const urls = async (windowId: number) =>
      (await browser.tabs.query({ windowId })).map(
        (t) => `${t.url}${t.groupId === gid ? '@g' : ''}`,
      );

    await browser.tabGroups.move(gid, { index: 1 });
    expect(await urls(w1)).toEqual(['https://c.test/', 'https://a.test/@g', 'https://b.test/@g']);

    await browser.tabGroups.move(gid, { windowId: w2, index: 0 });
    expect(await urls(w2)).toEqual(['https://a.test/@g', 'https://b.test/@g', 'https://x.test/']);
    expect((await browser.tabGroups.get(gid)).windowId).toBe(w2);
  });

  it('tracks lastAccessed with the fake clock', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const w = await fakeChrome.openWindow(['https://a.test/']);
    const [t] = await browser.tabs.query({ windowId: w });
    expect(t!.lastAccessed).toBe(Date.parse('2026-01-01T00:00:00Z'));
    vi.setSystemTime(new Date('2026-01-01T13:00:00Z'));
    fakeChrome.setLastAccessed(t!.id!, Date.now() - 13 * 3600_000);
    expect(Date.now() - (await browser.tabs.get(t!.id!)).lastAccessed!).toBe(13 * 3600_000);
    vi.useRealTimers();
  });

  it('fires an alarm by hand (the stock fake never fires)', async () => {
    const onAlarm = vi.fn();
    browser.alarms.onAlarm.addListener(onAlarm);
    await browser.alarms.create('auto-archive', { periodInMinutes: 5 });
    await (browser.alarms.onAlarm as unknown as { trigger(a: object): Promise<void> }).trigger({
      name: 'auto-archive',
      scheduledTime: Date.now(),
    });
    expect(onAlarm).toHaveBeenCalledOnce();
  });

  it('handles storage.session and sidePanel', async () => {
    await browser.storage.session.set({ liveTabs: { a: 1 } });
    expect(await browser.storage.session.get('liveTabs')).toEqual({ liveTabs: { a: 1 } });
    const w = await fakeChrome.openWindow();
    await browser.sidePanel.open({ windowId: w });
    expect(fakeChrome.sidePanelOpened).toEqual([w]);
  });
  it('connects a panel port to the worker and delivers messages both ways', async () => {
    const fromPanel: unknown[] = [];
    browser.runtime.onConnect.addListener((port) => {
      port.onMessage.addListener((m) => fromPanel.push(m));
      port.postMessage({ hello: port.name });
    });
    const port = fakeChrome.connect('sidesweep-panel');
    const fromWorker: unknown[] = [];
    port.onMessage.addListener((m) => fromWorker.push(m));
    port.postMessage({ ping: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(fromPanel).toEqual([{ ping: 1 }]);
    expect(fromWorker).toEqual([{ hello: 'sidesweep-panel' }]);
  });

  it('keeps one active tab per window', async () => {
    const w1 = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
    const w2 = await fakeChrome.openWindow(['https://c.test/']);
    const [a] = await browser.tabs.query({ windowId: w1, url: 'https://a.test/' });
    await browser.tabs.update(a!.id!, { active: true });
    const active = await browser.tabs.query({ active: true });
    expect(active.map((t) => [t.windowId, t.url])).toEqual([
      [w1, 'https://a.test/'],
      [w2, 'https://c.test/'],
    ]);
  });

  it('simulates a page change with patchTab and fires tabs.onUpdated', async () => {
    const w = await fakeChrome.openWindow(['https://a.test/']);
    const [tab] = await browser.tabs.query({ windowId: w });
    const onUpdated = vi.fn();
    browser.tabs.onUpdated.addListener(onUpdated);
    await fakeChrome.patchTab(tab!.id!, { title: 'New title' });
    expect((await browser.tabs.get(tab!.id!)).title).toBe('New title');
    expect(onUpdated).toHaveBeenCalledOnce();
  });
});
