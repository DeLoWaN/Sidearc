import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so the panel page runs in a normal tab.

test('a Tab group of Chrome shows as a block, and collapsing it works both ways', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const form = await context.newPage();
  await form.goto(`${site.origin}/form`);
  const other = await context.newPage();
  await other.goto(`${site.origin}/other`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  const groupId = await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ title: 'form' });
    const id = await chrome.tabs.group({ tabIds: [tab?.id as number] });
    await chrome.tabGroups.update(id, { title: 'Work', color: 'blue' });
    return id;
  });
  const collapsedInChrome = () =>
    serviceWorker.evaluate(async (id) => (await chrome.tabGroups.get(id)).collapsed, groupId);

  const block = panel.getByRole('group', { name: 'Work' });
  await expect(block).toHaveAttribute('data-color', 'blue');
  await expect(block.getByRole('button', { name: 'form', exact: true })).toBeVisible();

  // Panel to tab strip.
  await block.getByRole('button', { name: 'Work', exact: true }).click();
  await expect.poll(collapsedInChrome).toBe(true);
  await expect(block.getByRole('button', { name: 'form', exact: true })).toBeHidden();

  // Tab strip to panel.
  await serviceWorker.evaluate((id) => chrome.tabGroups.update(id, { collapsed: false }), groupId);
  await expect(block.getByRole('button', { name: 'form', exact: true })).toBeVisible();

  // A group renamed in Chrome shows its new title.
  await serviceWorker.evaluate((id) => chrome.tabGroups.update(id, { title: 'Home' }), groupId);
  await expect(panel.getByRole('group', { name: 'Home' })).toBeVisible();
});
