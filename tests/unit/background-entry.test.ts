import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../support/fake-chrome';

beforeEach(() => {
  fakeChrome.reset();
  vi.resetModules();
});

async function startBackground() {
  const { default: background } = await import('../../src/entrypoints/background');
  background.main();
}

it('opens the panel when the user clicks the extension icon', async () => {
  await startBackground();
  expect(await browser.sidePanel.getPanelBehavior()).toEqual({ openPanelOnActionClick: true });
});

it('opens the panel in the window where the user presses the panel shortcut', async () => {
  await startBackground();
  const w1 = await fakeChrome.openWindow(['https://a.test/']);
  const w2 = await fakeChrome.openWindow(['https://b.test/']);
  const [tab] = await browser.tabs.query({ windowId: w1 });
  await fakeChrome.events.commands.onCommand.trigger('open-panel', tab);
  expect(fakeChrome.sidePanelOpened).toEqual([w1]);
  expect(w2).not.toBe(w1);
});

it('does not open the panel for another shortcut', async () => {
  await startBackground();
  const w = await fakeChrome.openWindow(['https://a.test/']);
  const [tab] = await browser.tabs.query({ windowId: w });
  await fakeChrome.events.commands.onCommand.trigger('pin-current-tab', tab);
  expect(fakeChrome.sidePanelOpened).toEqual([]);
});
