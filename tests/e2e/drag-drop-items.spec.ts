import {
  dragTo,
  drop,
  openPanel,
  order,
  rowOf,
  saved,
  saveItems,
  storedItems,
  tabsOn,
} from './dnd-support';
import { expect, test } from './fixtures';

// Drags that start from a Favorite, a Pinned Tab or a Folder.

test('Pinned Tabs are reordered, and moved into a Folder, with an indicator above, below and inside', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  await saveItems(serviceWorker, [
    saved('a', 'pinned', 'A', 0),
    saved('b', 'pinned', 'B', 1),
    saved('c', 'pinned', 'C', 2),
    saved('home', 'folder', 'Home', 3),
    saved('h1', 'pinned', 'H1', 0, 'home'),
  ]);
  const panel = await openPanel(context, extensionId);
  const list = panel.getByRole('list', { name: 'Pinned Tabs list' });
  const row = (name: string) => rowOf(list, name);
  const handle = (name: string) => row(name).getByRole('button', { name, exact: true });
  const folderHeader = (name: string) => row(name).locator('button[aria-expanded]').first();
  await expect(row('C')).toBeVisible();

  // Above: C goes before A.
  await dragTo(panel, handle('C'), row('A'), 0.5, 0.15);
  await expect(row('A')).toHaveAttribute('data-drop', 'above');
  await drop(panel);
  await expect.poll(() => order(serviceWorker, null)).toEqual(['c', 'a', 'b', 'home']);

  // Below: C goes after B.
  await dragTo(panel, handle('C'), row('B'), 0.5, 0.85);
  await expect(row('B')).toHaveAttribute('data-drop', 'below');
  await drop(panel);
  await expect.poll(() => order(serviceWorker, null)).toEqual(['a', 'b', 'c', 'home']);

  // Inside: B goes to the top of the open Folder.
  await dragTo(panel, handle('B'), folderHeader('Home'), 0.5, 0.5);
  await expect(row('Home')).toHaveAttribute('data-drop', 'inside');
  await drop(panel);
  await expect.poll(() => order(serviceWorker, 'home')).toEqual(['b', 'h1']);
  await expect.poll(() => order(serviceWorker, null)).toEqual(['a', 'c', 'home']);
  await expect(
    panel
      .getByRole('list', { name: 'Home content' })
      .getByRole('button', { name: 'B', exact: true }),
  ).toBeVisible();
});

test('a Folder moves into another Folder, and Sidearc refuses a Folder inside its own content', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  await saveItems(serviceWorker, [
    saved('work', 'folder', 'Work', 0),
    saved('inner', 'folder', 'Inner', 0, 'work'),
    saved('home', 'folder', 'Home', 1),
  ]);
  const panel = await openPanel(context, extensionId);
  const list = panel.getByRole('list', { name: 'Pinned Tabs list' });
  const row = (name: string) => rowOf(list, name);
  const handle = (name: string) => row(name).locator('button[aria-expanded]').first();
  await expect(row('Inner')).toBeVisible();

  // Work onto Inner, which lies inside Work: no indicator, no change.
  await dragTo(panel, handle('Work'), handle('Inner'), 0.5, 0.5);
  await expect(panel.locator('[data-drop]')).toHaveCount(0);
  await drop(panel);
  await panel.waitForTimeout(300);
  expect(await order(serviceWorker, null)).toEqual(['work', 'home']);
  expect(await order(serviceWorker, 'work')).toEqual(['inner']);

  // Work onto Work: refused too.
  await dragTo(panel, handle('Work'), handle('Work'), 0.5, 0.5);
  await expect(panel.locator('[data-drop]')).toHaveCount(0);
  await drop(panel);

  // Home into Work works.
  await dragTo(panel, handle('Home'), handle('Work'), 0.5, 0.5);
  await expect(row('Work')).toHaveAttribute('data-drop', 'inside');
  await drop(panel);
  await expect.poll(() => order(serviceWorker, 'work')).toEqual(['home', 'inner']);
});

test('a Pinned Tab goes to the Favorites, and a Favorite goes to the Pinned Tabs', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  await saveItems(serviceWorker, [
    saved('docs', 'favorite', 'Docs', 0),
    saved('mail', 'pinned', 'Mail', 0),
    saved('notes', 'pinned', 'Notes', 1),
  ]);
  const panel = await openPanel(context, extensionId);
  const favorites = panel.getByRole('list', { name: 'Favorites list' });
  const pinned = panel.getByRole('list', { name: 'Pinned Tabs list' });
  const tile = (name: string) => rowOf(favorites, name);
  const handle = (name: string) => tile(name).getByRole('button', { name, exact: true });
  await expect(tile('Docs')).toBeVisible();

  // Pinned Tab to the Favorites: after the tile of Docs.
  await dragTo(
    panel,
    pinned.getByRole('button', { name: 'Mail', exact: true }),
    tile('Docs'),
    0.9,
    0.5,
  );
  await expect(tile('Docs')).toHaveAttribute('data-drop', 'after');
  await drop(panel);
  await expect.poll(() => order(serviceWorker, null, true)).toEqual(['docs', 'mail']);
  await expect.poll(() => order(serviceWorker, null)).toEqual(['notes']);

  // A Favorite reordered: Mail goes before Docs.
  await dragTo(panel, handle('Mail'), tile('Docs'), 0.1, 0.5);
  await expect(tile('Docs')).toHaveAttribute('data-drop', 'before');
  await drop(panel);
  await expect.poll(() => order(serviceWorker, null, true)).toEqual(['mail', 'docs']);

  // Favorite to the Pinned Tabs: above Notes.
  await dragTo(panel, handle('Docs'), rowOf(pinned, 'Notes'), 0.5, 0.15);
  await expect(rowOf(pinned, 'Notes')).toHaveAttribute('data-drop', 'above');
  await drop(panel);
  await expect.poll(() => order(serviceWorker, null)).toEqual(['docs', 'notes']);
  await expect.poll(() => order(serviceWorker, null, true)).toEqual(['mail']);
});

test('Sidearc refuses a 13th Favorite with a notice', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  await saveItems(serviceWorker, [
    ...Array.from({ length: 12 }, (_, i) => saved(`fav-${i}`, 'favorite', `Fav ${i}`, i)),
    saved('mail', 'pinned', 'Mail', 0),
  ]);
  const panel = await openPanel(context, extensionId);
  const favorites = panel.getByRole('list', { name: 'Favorites list' });
  await expect(rowOf(favorites, 'Fav 11')).toBeVisible();

  await dragTo(
    panel,
    panel
      .getByRole('list', { name: 'Pinned Tabs list' })
      .getByRole('button', { name: 'Mail', exact: true }),
    rowOf(favorites, 'Fav 0'),
    0.9,
    0.5,
  );
  await drop(panel);

  await expect(panel.getByRole('status')).toContainText('12 Favorites');
  expect(await order(serviceWorker, null, true)).toHaveLength(12);
  expect(await order(serviceWorker, null)).toEqual(['mail']);
});

test('a Pinned Tab or a Favorite dropped in the Unpinned Tabs becomes a normal tab, and its item goes', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const liveUrl = `${site.origin}/other`;
  const restUrl = `${site.origin}/blank`;
  await saveItems(serviceWorker, [
    saved('live', 'pinned', 'Live', 0, null, liveUrl),
    saved('rest', 'favorite', 'Rest', 0, null, restUrl),
  ]);
  const panel = await openPanel(context, extensionId);
  const unpinned = panel.getByRole('region', { name: 'Unpinned Tabs' });
  await panel.getByRole('button', { name: 'Live', exact: true }).click();
  await expect.poll(() => tabsOn(serviceWorker, liveUrl)).toBe(1);

  // An item with an open live tab: the item goes, the tab stays and shows in the list.
  await dragTo(panel, panel.getByRole('button', { name: 'Live', exact: true }), unpinned, 0.5, 0.5);
  await expect(unpinned).toHaveAttribute('data-drop', 'inside');
  await drop(panel);
  await expect(unpinned.getByRole('button', { name: 'other', exact: true })).toBeVisible();
  await expect.poll(async () => (await storedItems(serviceWorker)).length).toBe(1);
  expect(await tabsOn(serviceWorker, liveUrl)).toBe(1);

  // An item at rest: its saved URL opens as an Unpinned Tab.
  await dragTo(panel, panel.getByRole('button', { name: 'Rest', exact: true }), unpinned, 0.5, 0.5);
  await drop(panel);
  await expect(unpinned.getByRole('button', { name: 'blank', exact: true })).toBeVisible();
  await expect.poll(() => tabsOn(serviceWorker, restUrl)).toBe(1);
  await expect.poll(async () => (await storedItems(serviceWorker)).length).toBe(0);
});
