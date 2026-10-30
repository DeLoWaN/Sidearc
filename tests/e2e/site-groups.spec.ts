import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so the panel page runs in a normal tab.

test('tabs opened from a tab of the same site form a site group that the user can ungroup', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  // `localhost` and `127.0.0.1` reach the same server and are two sites.
  const otherSite = site.origin.replace('127.0.0.1', 'localhost');
  const links = await context.newPage();
  await links.route('**/links', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>links</title><a href="/other">same site</a> <a href="${otherSite}/other">other site</a>`,
    }),
  );
  await links.goto(`${site.origin}/links`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const blocks = panel.locator('[data-site-group]');
  await expect(panel.getByRole('listitem').filter({ hasText: 'links' })).toBeVisible();
  await expect(blocks).toHaveCount(0);

  await links.bringToFront();
  await links.getByRole('link', { name: 'same site' }).click({ button: 'middle' });

  await expect(blocks).toHaveCount(1);
  const host = new URL(site.origin).host;
  // The count shows only while the group is collapsed.
  await blocks.getByRole('button', { name: host }).click();
  await expect(blocks.getByRole('button', { name: host })).toContainText('2');
  await blocks.getByRole('button', { name: host }).click();
  await expect(blocks.getByRole('listitem')).toHaveText(['links', 'other']);

  await blocks.getByRole('button', { name: host }).click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Ungroup' }).click();

  await expect(blocks).toHaveCount(0);
  await expect(panel.getByRole('listitem').filter({ hasText: /^(links|other)$/ })).toHaveCount(2);

  await links.bringToFront();
  await links.getByRole('link', { name: 'other site' }).click({ button: 'middle' });

  await expect(panel.getByRole('listitem').filter({ hasText: /^other$/ })).toHaveCount(2);
  // The worker has judged every new tab when none waits for its address.
  await expect
    .poll(async () =>
      serviceWorker.evaluate(async () => {
        const stored = await chrome.storage.session.get('siteGroups');
        return (stored.siteGroups as { pending: number[] } | undefined)?.pending ?? [];
      }),
    )
    .toEqual([]);
  await expect(blocks).toHaveCount(0);
});
