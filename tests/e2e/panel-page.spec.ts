import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so these tests open the panel page in a normal tab.

test('the panel page opens without an error and shows the Sidesweep page', async ({
  context,
  extensionId,
}) => {
  const problems: string[] = [];
  const panel = await context.newPage();
  panel.on('pageerror', (error) => problems.push(error.message));
  panel.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.getByRole('main', { name: 'Sidesweep' })).toBeAttached();
  expect(problems).toEqual([]);
});

test('the options page opens and shows its title', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByRole('heading', { name: 'Sidesweep options' })).toBeVisible();
});

test('the worker answers a one-off request from the panel page', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const answer = await panel.evaluate(() =>
    chrome.runtime.sendMessage({ rpc: 'worker/ping', request: 'a' }),
  );
  expect(answer).toBe('pong a');
});

test('the extension opens the panel on an icon click and declares the panel shortcut', async ({
  serviceWorker,
}) => {
  const behavior = await serviceWorker.evaluate(() => chrome.sidePanel.getPanelBehavior());
  expect(behavior.openPanelOnActionClick).toBe(true);

  const manifest = await serviceWorker.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.side_panel?.default_path).toBe('sidepanel.html');
  expect(manifest.minimum_chrome_version).toBe('141');
  expect(manifest.commands?.['open-panel']?.suggested_key).toMatchObject({
    default: 'Alt+Shift+S',
  });
});
