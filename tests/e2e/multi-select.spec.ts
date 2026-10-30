import {
  dragTo,
  drop,
  openPanel,
  openTabs,
  rowOf,
  saved,
  saveItems,
  storedItems,
} from './dnd-support';
import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so the panel page runs in a normal tab.

const tabsOn = (serviceWorker: import('@playwright/test').Worker, origin: string, path: string) =>
  serviceWorker.evaluate(
    async (url) => (await chrome.tabs.query({ url })).length,
    `${origin}${path}`,
  );

test('three selected Unpinned Tabs close in one go, and one Undo brings them back', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await openTabs(context, [`${site.origin}/form`, `${site.origin}/other`, `${site.origin}/blank`]);
  const panel = await openPanel(context, extensionId);
  const row = (name: string) => panel.getByRole('button', { name, exact: true });
  await expect(row('blank')).toBeVisible();

  await row('form').click({ modifiers: ['ControlOrMeta'] });
  await row('other').click({ modifiers: ['Shift'] });
  await row('blank').click({ modifiers: ['ControlOrMeta'] });

  await expect(panel.getByRole('status')).toHaveText(/3 selected/);
  await panel.getByRole('button', { name: 'Close', exact: true }).click();

  await expect(row('form')).toBeHidden();
  for (const path of ['/form', '/other', '/blank']) {
    expect(await tabsOn(serviceWorker, site.origin, path)).toBe(0);
  }
  await expect(panel.getByRole('status')).toContainText('Closed 3 items');

  await panel.getByRole('status').getByRole('button', { name: 'Undo' }).click();

  for (const path of ['/form', '/other', '/blank']) {
    await expect.poll(() => tabsOn(serviceWorker, site.origin, path)).toBe(1);
  }
  await expect(row('form')).toBeVisible();
  await expect(row('blank')).toBeVisible();
});

test('a selection of two Unpinned Tabs is dragged into a Folder in one move', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await saveItems(serviceWorker, [saved('work', 'folder', 'Work', 0)]);
  await openTabs(context, [`${site.origin}/form`, `${site.origin}/other`]);
  const panel = await openPanel(context, extensionId);
  const unpinned = panel.getByRole('region', { name: 'Unpinned Tabs' });
  const work = rowOf(panel.getByRole('list', { name: 'Pinned Tabs list' }), 'Work');
  const handle = (name: string) => unpinned.getByRole('button', { name, exact: true });
  await expect(handle('other')).toBeVisible();

  await handle('form').click({ modifiers: ['ControlOrMeta'] });
  await handle('other').click({ modifiers: ['ControlOrMeta'] });
  await expect(panel.getByRole('status')).toHaveText(/2 selected/);

  await dragTo(panel, handle('other'), work, 0.5, 0.5);
  await expect(work).toHaveAttribute('data-drop', 'inside');
  await drop(panel);

  const inWork = panel.getByRole('list', { name: 'Work content' });
  await expect(inWork.getByRole('button', { name: 'form', exact: true })).toBeVisible();
  await expect(inWork.getByRole('button', { name: 'other', exact: true })).toBeVisible();
  await expect(unpinned).not.toContainText('form');
  await expect(panel.getByRole('status')).toBeHidden();
  const moved = (await storedItems(serviceWorker)).filter((item) => item.parentId === 'work');
  expect(moved.sort((a, b) => a.position - b.position).map((item) => item.title)).toEqual([
    'form',
    'other',
  ]);
});
