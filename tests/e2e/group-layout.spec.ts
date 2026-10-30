import type { BrowserContext, Locator } from '@playwright/test';
import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so the panel page runs in a normal tab.

// The value of --group-tint in app.css, for each colour scheme.
const TINT = { light: 'rgba(255, 255, 255, 0.28)', dark: 'rgba(255, 255, 255, 0.05)' } as const;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const background = (element: Locator) =>
  element.evaluate((node) => getComputedStyle(node).backgroundColor);

/**
 * Opens a page "links", a tab "other" that opens from it on the same site (a site group), and a tab "blank" outside of any group.
 * Returns the panel page.
 */
async function openSiteGroup(context: BrowserContext, extensionId: string, origin: string) {
  const links = await context.newPage();
  await links.route('**/links', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>links</title><a href="/other">same site</a>',
    }),
  );
  await links.goto(`${origin}/links`);
  // `localhost` and `127.0.0.1` reach the same server and are two sites, so this tab stays out of the group.
  const blank = await context.newPage();
  await blank.goto(`${origin.replace('127.0.0.1', 'localhost')}/blank`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.getByRole('listitem').filter({ hasText: 'links' })).toBeVisible();

  await links.bringToFront();
  await links.getByRole('link', { name: 'same site' }).click({ button: 'middle' });
  await expect(panel.locator('[data-site-group]')).toHaveCount(1);
  await panel.bringToFront();
  return panel;
}

for (const scheme of ['light', 'dark'] as const) {
  test(`group layout (${scheme}): the header is a row, and a hover or a keyboard focus tints the whole group`, async ({
    context,
    extensionId,
    site,
  }) => {
    const panel = await openSiteGroup(context, extensionId, site.origin);
    await panel.emulateMedia({ colorScheme: scheme });
    const group = panel.locator('[data-site-group]');
    const host = new URL(site.origin).host;
    const header = group.getByRole('button', { name: host, exact: true });
    // A member opened in the background is unvisited, so its button name has an extra part: use the rows.
    const member = group.getByRole('listitem').filter({ hasText: 'other' });
    const outside = panel.getByRole('listitem').filter({ hasText: /^blank$/ });

    // The header has the left edge and the height of a tab row, and the members sit 24px to the right.
    const [headerBox, outsideBox, memberBox] = await Promise.all([
      header.boundingBox(),
      outside.boundingBox(),
      member.boundingBox(),
    ]);
    expect(headerBox?.x).toBe(outsideBox?.x);
    expect(headerBox?.height).toBe(outsideBox?.height);
    expect((memberBox?.x ?? 0) - (headerBox?.x ?? 0)).toBe(24);
    expect(
      await group.locator('ul').evaluate((list) => getComputedStyle(list).borderLeftWidth),
    ).toBe('0px');

    // A hover on a member tints the group, and no row outside of it.
    await panel.mouse.move(0, 0);
    expect(await background(group)).toBe(TRANSPARENT);
    await member.hover();
    expect(await background(group)).toBe(TINT[scheme]);
    expect(await background(outside)).toBe(TRANSPARENT);
    await header.hover();
    expect(await background(group)).toBe(TINT[scheme]);
    await outside.hover();
    expect(await background(group)).toBe(TRANSPARENT);

    // A keyboard focus on the header tints the group too.
    await panel.mouse.move(0, 0);
    await panel.keyboard.press('Shift');
    await header.focus();
    await expect(header).toBeFocused();
    expect(await background(group)).toBe(TINT[scheme]);
  });
}

test('the user renames a site group from the right-click menu of its header, and clears the name', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const panel = await openSiteGroup(context, extensionId, site.origin);
  const group = panel.locator('[data-site-group]');
  const host = new URL(site.origin).host;
  const storedName = () =>
    serviceWorker.evaluate(async () => {
      const stored = await chrome.storage.session.get('siteGroups');
      return (stored.siteGroups as { groups: { name?: string }[] }).groups[0]?.name ?? null;
    });

  await group.getByRole('button', { name: host, exact: true }).click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Rename group' }).click();
  const field = panel.getByRole('textbox', { name: `Name of ${host}` });
  await expect(field).toHaveValue(host);
  await field.fill('Reading list');
  await field.press('Enter');

  await expect(group.getByRole('button', { name: 'Reading list', exact: true })).toBeVisible();
  await expect(panel.getByRole('group', { name: 'Reading list' })).toBeVisible();
  await expect.poll(storedName).toBe('Reading list');

  await group.getByRole('button', { name: 'Reading list', exact: true }).click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Rename group' }).click();
  await panel.getByRole('textbox', { name: 'Name of Reading list' }).fill('   ');
  await panel.keyboard.press('Enter');

  await expect(group.getByRole('button', { name: host, exact: true })).toBeVisible();
  await expect.poll(storedName).toBeNull();
});
