import { expect, test } from './fixtures';

test('a Pinned Tab deleted with its cross comes back with the Undo button', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await serviceWorker.evaluate(async (url) => {
    await chrome.storage.local.set({
      items: [
        {
          id: 'pinned-1',
          kind: 'pinned',
          title: 'Saved',
          url,
          parentId: null,
          position: 0,
          collapsed: false,
        },
      ],
    });
  }, `${site.origin}/other`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const row = panel.getByRole('button', { name: 'Saved', exact: true });
  const footerUndo = panel.getByRole('contentinfo').getByRole('button', { name: 'Undo' });
  await expect(row).toBeVisible();
  await expect(footerUndo).toBeDisabled();

  await panel.getByRole('listitem').filter({ hasText: 'Saved' }).hover();
  await panel.getByRole('button', { name: 'Delete Saved' }).click();

  await expect(row).toBeHidden();
  await expect(panel.getByRole('status')).toContainText('Deleted "Saved"');
  await expect(footerUndo).toBeEnabled();

  await footerUndo.click();

  await expect(row).toBeVisible();
  await expect(footerUndo).toBeDisabled();
});

test('a Pinned Tab deleted with the Delete entry of its right-click menu comes back with the Undo button', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await serviceWorker.evaluate(async (url) => {
    await chrome.storage.local.set({
      items: [
        {
          id: 'pinned-1',
          kind: 'pinned',
          title: 'Saved',
          url,
          parentId: null,
          position: 0,
          collapsed: false,
        },
      ],
    });
  }, `${site.origin}/other`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const row = panel.getByRole('button', { name: 'Saved', exact: true });
  await expect(row).toBeVisible();

  await row.click({ button: 'right' });
  await panel
    .getByRole('menu', { name: 'Actions for Saved' })
    .getByRole('menuitem', { name: 'Delete' })
    .click();

  await expect(row).toBeHidden();
  await expect(panel.getByRole('status')).toContainText('Deleted "Saved"');

  await panel.getByRole('status').getByRole('button', { name: 'Undo' }).click();

  await expect(row).toBeVisible();
});
