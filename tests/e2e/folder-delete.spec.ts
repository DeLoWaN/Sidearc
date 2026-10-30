import { expect, test } from './fixtures';

test('a Folder with content, deleted with its cross and confirmed, comes back with the Undo button', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const items = [
    { id: 'work', kind: 'folder', title: 'Work', url: '', parentId: null, position: 0 },
    { id: 'projects', kind: 'folder', title: 'Projects', url: '', parentId: 'work', position: 0 },
    {
      id: 'wiki',
      kind: 'pinned',
      title: 'Wiki',
      url: `${site.origin}/other`,
      parentId: 'projects',
      position: 0,
    },
    {
      id: 'mail',
      kind: 'pinned',
      title: 'Mail',
      url: `${site.origin}/blank`,
      parentId: 'work',
      position: 1,
    },
  ].map((item) => ({ ...item, collapsed: item.id === 'projects' }));
  await serviceWorker.evaluate((records) => chrome.storage.local.set({ items: records }), items);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const folder = panel.getByRole('button', { name: 'Work', exact: true });
  const mail = panel.getByRole('button', { name: 'Mail', exact: true });
  await expect(folder).toBeVisible();
  await expect(mail).toBeVisible();

  await folder.hover();
  await panel.getByRole('button', { name: 'Delete Work' }).click();
  await panel
    .getByRole('alertdialog', { name: 'Delete Work?' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect(folder).toBeHidden();
  await expect(mail).toBeHidden();

  await panel.getByRole('status').getByRole('button', { name: 'Undo' }).click();

  await expect(folder).toBeVisible();
  await expect(mail).toBeVisible();
  // The nested Folder comes back collapsed, so its Pinned Tab stays hidden.
  await expect(panel.getByRole('button', { name: 'Projects', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(panel.getByRole('button', { name: 'Wiki', exact: true })).toBeHidden();
});
