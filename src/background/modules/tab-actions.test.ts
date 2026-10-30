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

it('focuses the window of a tab that is in another window', async () => {
  const first = await fakeChrome.openWindow(['https://a.test/', 'https://b.test/']);
  const second = await fakeChrome.openWindow(['https://c.test/']);
  const panel = connectPanel(second);

  panel.send({ type: 'tab/activate', tabId: await tabOf('https://a.test/') });
  await settle();

  const [active] = await browser.tabs.query({ windowId: first, active: true });
  expect(active?.url).toBe('https://a.test/');
  expect((await browser.windows.getCurrent()).id).toBe(first);
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
