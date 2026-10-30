import { expect, test } from './fixtures';

const folder = (id: string, title: string, parentId: string | null, position: number) => ({
  id,
  kind: 'folder',
  title,
  url: '',
  parentId,
  position,
  collapsed: false,
});

test('Folders: create, collapse, move a Pinned Tab with its live tab, and delete with confirmation', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const savedUrl = `${site.origin}/other`;
  await serviceWorker.evaluate(
    async ([url, work, home]) => {
      await chrome.storage.local.set({
        items: [
          work,
          home,
          {
            id: 'pinned-1',
            kind: 'pinned',
            title: 'Saved',
            url,
            parentId: 'work',
            position: 0,
            collapsed: false,
          },
        ],
      });
    },
    [savedUrl, folder('work', 'Work', null, 0), folder('home', 'Home', null, 1)] as const,
  );
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const inWork = panel.getByRole('list', { name: 'Work content' });
  const tabsOnSavedUrl = () =>
    serviceWorker.evaluate(async (url) => (await chrome.tabs.query({ url })).length, savedUrl);

  // Create a Folder inside "Home".
  await expect(inWork.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Home', exact: true }).click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'New folder' }).click();
  await panel.getByRole('textbox', { name: 'Name of the new folder' }).fill('Archive');
  await panel.keyboard.press('Enter');
  await expect(
    panel.getByRole('list', { name: 'Home content' }).getByRole('button', { name: 'Archive' }),
  ).toBeVisible();

  // Open the live tab, then move the Pinned Tab into "Home": the live tab stays.
  await panel.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect.poll(tabsOnSavedUrl).toBe(1);
  await panel.getByRole('button', { name: /^Saved/ }).click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Move to…' }).click();
  await panel.getByRole('menuitem', { name: 'Home', exact: true }).click();
  const inHome = panel.getByRole('list', { name: 'Home content' });
  await expect(inHome.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await expect(inWork.getByRole('button', { name: 'Saved', exact: true })).toBeHidden();
  await expect(panel.getByRole('button', { name: 'Close Saved' })).toBeAttached();
  await expect.poll(tabsOnSavedUrl).toBe(1);

  // Collapse "Home": its content hides, and the state stays after a reload of the panel.
  await panel.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(inHome).toBeHidden();
  await panel.reload();
  await expect(panel.getByRole('button', { name: 'Home', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(panel.getByRole('list', { name: 'Home content' })).toBeHidden();

  // Deleting "Home" asks first. The live tab stays open.
  await panel.getByRole('button', { name: 'Home', exact: true }).click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Delete' }).click();
  await panel.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(panel.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Home', exact: true }).click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Delete' }).click();
  await panel.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(panel.getByRole('button', { name: 'Home', exact: true })).toBeHidden();
  await expect.poll(tabsOnSavedUrl).toBe(1);
});
