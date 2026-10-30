import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so the panel page opens in a normal tab.

test('the extension menu opens the options page in a tab', async ({ serviceWorker }) => {
  const manifest = await serviceWorker.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.options_ui).toMatchObject({ page: 'options.html', open_in_tab: true });
});

test('the Options button of the panel opens the options page', async ({ context, extensionId }) => {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  const opened = context.waitForEvent('page');
  await panel.getByRole('button', { name: 'Options' }).click();

  const options = await opened;
  await options.waitForLoadState();
  expect(options.url()).toBe(`chrome-extension://${extensionId}/options.html`);
});

test('a change in the options page changes the open panel at once and stays after a reload', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);

  const rowHeight = () =>
    panel.evaluate(() => document.documentElement.style.getPropertyValue('--row-height'));
  const gradient = () =>
    panel.evaluate(
      () =>
        getComputedStyle(document.querySelector('.panel-background') as Element).backgroundImage,
    );
  await expect.poll(rowHeight).toBe('32px');

  await options.getByRole('radio', { name: 'Compact' }).check();
  await options.getByLabel('Gradient start').fill('#000000');
  await options.getByLabel('Gradient end').fill('#ffffff');

  await expect.poll(rowHeight).toBe('28px');
  await panel.emulateMedia({ colorScheme: 'light' });
  await expect.poll(gradient).toContain('rgb(179, 179, 179)');
  await panel.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(gradient).toContain('rgb(89, 89, 89)');

  await options.reload();
  await expect(options.getByRole('radio', { name: 'Compact' })).toBeChecked();
  await expect(options.getByLabel('Gradient start')).toHaveValue('#000000');
});

test('the Auto Archive delay stays after a reload and a refused delay shows an error', async ({
  context,
  extensionId,
}) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const delay = options.getByRole('spinbutton', { name: 'Auto Archive delay in hours' });
  await expect(delay).toHaveValue('12');

  await delay.fill('0');
  await delay.press('Enter');
  await expect(options.getByRole('alert')).toContainText('autoArchiveHours must be a whole number');

  await delay.fill('72');
  await delay.press('Enter');
  await expect(options.getByRole('alert')).toHaveCount(0);

  await options.reload();
  await expect(delay).toHaveValue('72');
});
