import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so the panel page runs in a normal tab.

test('a tab that opens in the background from a link is marked until the user shows it', async ({
  context,
  extensionId,
  site,
}) => {
  const links = await context.newPage();
  await links.route('**/links', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>links</title><a href="/other">open</a>',
    }),
  );
  await links.goto(`${site.origin}/links`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const otherRow = panel.getByRole('listitem').filter({ hasText: 'other' });
  const marker = panel.getByRole('img', { name: 'Not visited yet' });
  await expect(panel.getByRole('listitem').filter({ hasText: 'links' })).toBeVisible();
  await expect(marker).toHaveCount(0);

  await links.bringToFront();
  await links.getByRole('link', { name: 'open' }).click({ button: 'middle' });

  await expect(otherRow.getByRole('img', { name: 'Not visited yet' })).toBeVisible();
  await expect(marker).toHaveCount(1);
  await expect(otherRow.getByText('other', { exact: true })).toHaveCSS('font-weight', '600');

  await otherRow.getByRole('button', { name: /other/ }).first().click();

  await expect(marker).toHaveCount(0);
});
