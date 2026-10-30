import {
  dragTo,
  drop,
  hasLiveTab,
  openPanel,
  openTabs,
  rowOf,
  saved,
  saveItems,
  storedItems,
  strip,
} from './dnd-support';
import { expect, test } from './fixtures';

// Drags that start from an Unpinned Tab.

test('an Unpinned Tab dropped inside a Folder becomes a Pinned Tab and the tab becomes its live tab', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await saveItems(serviceWorker, [saved('work', 'folder', 'Work', 0)]);
  await openTabs(context, [`${site.origin}/form`]);
  const panel = await openPanel(context, extensionId);
  const work = rowOf(panel.getByRole('list', { name: 'Pinned Tabs list' }), 'Work');
  const tab = rowOf(panel.getByRole('region', { name: 'Unpinned Tabs' }), 'form');
  await expect(tab).toBeVisible();

  await dragTo(panel, tab.getByRole('button', { name: 'form', exact: true }), work, 0.5, 0.5);
  await expect(work).toHaveAttribute('data-drop', 'inside');
  await drop(panel);

  const inWork = panel.getByRole('list', { name: 'Work content' });
  await expect(inWork.getByRole('button', { name: 'form', exact: true })).toBeVisible();
  await expect(panel.getByRole('region', { name: 'Unpinned Tabs' })).not.toContainText('form');
  const [created] = (await storedItems(serviceWorker)).filter((item) => item.title === 'form');
  expect(created).toMatchObject({ kind: 'pinned', parentId: 'work', url: `${site.origin}/form` });
  await expect.poll(() => hasLiveTab(serviceWorker, created?.id as string)).toBe(true);
  await expect(panel.getByRole('button', { name: 'Close form' })).toBeAttached();
});

test('an Unpinned Tab dropped in the empty Favorites area becomes the first Favorite', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await openTabs(context, [`${site.origin}/form`]);
  const panel = await openPanel(context, extensionId);
  const tab = rowOf(panel.getByRole('region', { name: 'Unpinned Tabs' }), 'form');
  await expect(tab).toBeVisible();
  await expect(panel.getByRole('region', { name: 'Favorites' })).toBeHidden();

  // The Favorites show a place to drop while the user drags.
  await dragTo(
    panel,
    tab.getByRole('button', { name: 'form', exact: true }),
    panel.getByRole('region', { name: 'Pinned Tabs', exact: true }),
    0.5,
    0.5,
  );
  const zone = panel.getByRole('region', { name: 'Favorites' });
  await expect(zone).toBeVisible();
  const box = await zone.boundingBox();
  if (!box) throw new Error('No Favorites zone');
  await panel.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await expect(zone).toHaveAttribute('data-drop', 'inside');
  await drop(panel);

  await expect(
    panel
      .getByRole('list', { name: 'Favorites list' })
      .getByRole('button', { name: 'form', exact: true }),
  ).toBeVisible();
  const [created] = await storedItems(serviceWorker);
  expect(created).toMatchObject({ kind: 'favorite', title: 'form', url: `${site.origin}/form` });
  await expect.poll(() => hasLiveTab(serviceWorker, created?.id as string)).toBe(true);
});

test('an Unpinned Tab is reordered, joins a Tab group between two of its tabs, and leaves it', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  await openTabs(context, [`${site.origin}/form`, `${site.origin}/other`, `${site.origin}/blank`]);
  const panel = await openPanel(context, extensionId);
  await serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const idOf = (title: string) => tabs.find((tab) => tab.title === title)?.id as number;
    const group = (await chrome.tabs.group({ tabIds: [idOf('other'), idOf('blank')] })) as number;
    await chrome.tabGroups.update(group, { title: 'G' });
  });
  const unpinned = panel.getByRole('region', { name: 'Unpinned Tabs' });
  const handle = (name: string) => unpinned.getByRole('button', { name, exact: true });
  const row = (name: string) => rowOf(unpinned, name);
  await expect(handle('blank')).toBeVisible();
  const titles = ['form', 'other', 'blank'];
  expect(await strip(serviceWorker, titles)).toEqual(['form', 'other@group', 'blank@group']);

  // Outside any group: form goes after the panel tab.
  await dragTo(panel, handle('form'), row('Sidearc'), 0.5, 0.85);
  await expect(row('Sidearc')).toHaveAttribute('data-drop', 'below');
  await drop(panel);
  await expect
    .poll(() => strip(serviceWorker, titles))
    .toEqual(['other@group', 'blank@group', 'form']);

  // Between two tabs of the group: form joins it.
  await dragTo(panel, handle('form'), row('blank'), 0.5, 0.15);
  await expect(row('blank')).toHaveAttribute('data-drop', 'above');
  await drop(panel);
  await expect
    .poll(() => strip(serviceWorker, titles))
    .toEqual(['other@group', 'form@group', 'blank@group']);

  // Onto a row outside the group: form leaves it.
  await dragTo(panel, handle('form'), row('Sidearc'), 0.5, 0.85);
  await drop(panel);
  await expect
    .poll(() => strip(serviceWorker, titles))
    .toEqual(['other@group', 'blank@group', 'form']);
});
