import { expect, test } from './fixtures';

test('the options page imports an Arc space into the open panel, once', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);

  await options
    .getByLabel('Arc sidebar file')
    .setInputFiles('tests/fixtures/arc/StorableSidebar.trimmed.json');
  await options.getByRole('combobox', { name: 'Arc space' }).selectOption({ label: 'Alpha' });
  await options.getByRole('button', { name: 'Import', exact: true }).click();

  await expect(options.getByRole('status')).toContainText(
    '3 Favorites, 9 Pinned Tabs and 5 Folders',
  );
  await expect(panel.getByText('Example Docs')).toBeVisible();
  await expect(panel.getByText('Work')).toBeVisible();

  await options.reload();
  await expect(options.getByRole('heading', { name: 'Auto Archive' })).toBeVisible();
  await expect(options.getByRole('heading', { name: 'Import from Arc' })).toHaveCount(0);
});
