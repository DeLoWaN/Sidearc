import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const FIXTURE = 'tests/fixtures/arc/StorableSidebar.trimmed.json';

/** Chooses the Arc file and the space in the options page, then clicks Import. */
async function importSpace(options: Page, space: string) {
  await options.getByLabel('Arc sidebar file').setInputFiles(FIXTURE);
  await options.getByRole('combobox', { name: 'Arc space' }).selectOption({ label: space });
  await options.getByRole('button', { name: 'Import', exact: true }).click();
}

test('the first-run card of the panel leads to the Arc import, which fills the open panel', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.getByText('Your Pinned Tabs will show here.')).toBeVisible();

  const opened = context.waitForEvent('page');
  await panel.getByRole('button', { name: 'Import from Arc' }).click();
  const options = await opened;
  await options.waitForLoadState();

  expect(options.url()).toBe(`chrome-extension://${extensionId}/options.html`);
  const titles = options.getByRole('heading', { level: 2 });
  await expect(titles.first()).toHaveText('Import from Arc');
  await expect(
    options.getByRole('listitem').filter({ hasText: 'Arc can stay open.' }),
  ).toBeVisible();

  await importSpace(options, 'Alpha');

  await expect(options.getByRole('status')).toContainText(
    '3 Favorites, 9 Pinned Tabs and 5 Folders',
  );
  await expect(panel.getByText('Example Docs')).toBeVisible();
  await expect(panel.getByText('Work')).toBeVisible();
  await expect(panel.getByText('Your Pinned Tabs will show here.')).toHaveCount(0);
});

test('the Arc import stays on the options page, asks before it replaces the data, and can be undone', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await importSpace(options, 'Beta');
  await expect(panel.getByText('Beta home')).toBeVisible();

  await options.reload();
  await expect(options.getByRole('heading', { name: 'Import from Arc' })).toBeVisible();
  await expect(options.getByRole('heading', { level: 2 }).last()).toHaveText('Import from Arc');

  await importSpace(options, 'Alpha');
  const dialog = options.getByRole('alertdialog');
  await expect(dialog).toContainText('Sidesweep has 14 items now.');
  await expect(dialog).toContainText('the Arc space "Alpha"');

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByText('Beta home')).toBeVisible();
  await expect(panel.getByText('Example Docs')).toHaveCount(0);

  await options.getByRole('button', { name: 'Import', exact: true }).click();
  await dialog.getByRole('button', { name: 'Replace my data' }).click();

  await expect(options.getByRole('status')).toContainText(
    '3 Favorites, 9 Pinned Tabs and 5 Folders',
  );
  await expect(panel.getByText('Example Docs')).toBeVisible();
  await expect(panel.getByText('Beta home')).toHaveCount(0);

  await panel.getByRole('button', { name: 'Undo' }).click();
  await expect(panel.getByText('Beta home')).toBeVisible();
  await expect(panel.getByText('Example Docs')).toHaveCount(0);
});
