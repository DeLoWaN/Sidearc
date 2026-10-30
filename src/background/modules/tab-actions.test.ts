import { beforeEach, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker } from '../../../tests/support/worker';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

const tabOf = async (url: string) => (await browser.tabs.query({ url }))[0]?.id as number;
const urlsOf = async (windowId: number) =>
  (await browser.tabs.query({ windowId })).map((tab) => tab.url);

it('shows a tab of the same window when the panel asks for it', async () => {
  const window = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  const panel = connectPanel(window);

  panel.send({ type: 'tab/activate', tabId: await tabOf('https://a.test/') });
  await settle();

  const [active] = await browser.tabs.query({ windowId: window, active: true });
  expect(active?.url).toBe('https://a.test/');
});

it('moves a tab of another window into the window of the panel and shows it', async () => {
  const first = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  const second = await fakeChrome.openWindow(['https://c.test/']);
  const panel = connectPanel(second);
  const tabId = await tabOf('https://a.test/');

  panel.send({ type: 'tab/activate', tabId });
  await settle();

  expect(await urlsOf(second)).toEqual(['https://c.test/', 'https://a.test/']);
  expect(await urlsOf(first)).toEqual(['https://b.test/']);
  const [active] = await browser.tabs.query({ windowId: second, active: true });
  expect(active?.id).toBe(tabId);
});

it('never creates or reloads a tab when it moves a tab of another window', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  const second = await fakeChrome.openWindow(['https://c.test/']);
  const panel = connectPanel(second);
  const tabId = await tabOf('https://a.test/');
  const created: number[] = [];
  const updated: unknown[] = [];
  fakeChrome.events.tabs.onCreated.addListener((tab) => void created.push(tab.id as number));
  fakeChrome.events.tabs.onUpdated.addListener((_id, change) => void updated.push(change));

  panel.send({ type: 'tab/activate', tabId });
  await settle();

  expect(created).toEqual([]);
  expect(updated).toEqual([]);
  expect(await browser.tabs.query({})).toHaveLength(2);
  expect((await browser.tabs.get(tabId)).url).toBe('https://a.test/');
});

it('closes the source window when the moved tab was its only tab, and the panel stays correct', async () => {
  await fakeChrome.openWindow(['https://a.test/']);
  const second = await fakeChrome.openWindow(['https://c.test/']);
  const panel = connectPanel(second);
  const tabId = await tabOf('https://a.test/');

  panel.send({ type: 'tab/activate', tabId });
  await settle();

  expect((await browser.windows.getAll()).map((window) => window.id)).toEqual([second]);
  expect(panel.latest()?.unpinnedTabs.map((tab) => [tab.url, tab.windowId, tab.active])).toEqual([
    ['https://c.test/', second, false],
    ['https://a.test/', second, true],
  ]);
});

it('closes the tab that the panel asks to close', async () => {
  const window = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  const panel = connectPanel(window);

  panel.send({ type: 'tab/close', tabId: await tabOf('https://a.test/') });
  await settle();

  expect(await urlsOf(window)).toEqual(['https://b.test/']);
});

it('moves a tab in the tab strip when the panel asks for it', async () => {
  const window = await fakeChrome.openWindow([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/',
  ]);
  const panel = connectPanel(window);

  panel.send({ type: 'tab/move', tabId: await tabOf('https://c.test/'), index: 0 });
  await settle();

  expect(await urlsOf(window)).toEqual(['https://c.test/', 'https://a.test/', 'https://b.test/']);
});

it('keeps the tab of another window in its window when the panel moves it', async () => {
  const first = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  const second = await fakeChrome.openWindow(['https://c.test/']);
  const panel = connectPanel(second);

  panel.send({ type: 'tab/move', tabId: await tabOf('https://b.test/'), index: 0 });
  await settle();

  expect(await urlsOf(first)).toEqual(['https://b.test/', 'https://a.test/']);
  expect(await urlsOf(second)).toEqual(['https://c.test/']);
});
