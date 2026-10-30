import { expect, test } from './fixtures';

const mail = {
  id: 'mail',
  kind: 'pinned',
  title: 'Mail',
  url: 'http://127.0.0.1:1/mail',
  parentId: null,
  position: 0,
  collapsed: false,
};

const work = {
  id: 'work',
  kind: 'folder',
  title: 'Work',
  url: '',
  parentId: null,
  position: 1,
  collapsed: false,
};

// The value of --menu-active in app.css, for each colour scheme.
const ACTIVE_BACKGROUND = {
  light: 'rgb(220, 227, 245)',
  dark: 'rgb(69, 76, 96)',
} as const;

for (const scheme of ['light', 'dark'] as const) {
  test(`context menu (${scheme}): hover highlights an entry, and the Move to… submenu moves the item`, async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    await serviceWorker.evaluate(
      async ([item, folder]) => {
        await chrome.storage.local.set({ items: [item, folder] });
      },
      [mail, work] as const,
    );
    const panel = await context.newPage();
    await panel.emulateMedia({ colorScheme: scheme });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await panel.getByRole('button', { name: 'Mail', exact: true }).click({ button: 'right' });
    const menu = panel.getByRole('menu', { name: 'Actions for Mail' });
    await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeFocused();

    // The pointer moves the active entry, and the active entry has the highlight colour.
    const copyUrl = menu.getByRole('menuitem', { name: 'Copy URL' });
    await copyUrl.hover();
    await expect(copyUrl).toBeFocused();
    await expect(copyUrl).toHaveCSS('background-color', ACTIVE_BACKGROUND[scheme]);
    await expect(menu.getByRole('menuitem', { name: 'Rename' })).not.toHaveCSS(
      'background-color',
      ACTIVE_BACKGROUND[scheme],
    );

    // The submenu opens beside its entry when the pointer rests on it, inside the panel.
    await menu.getByRole('menuitem', { name: 'Move to…' }).hover();
    const submenu = panel.getByRole('menu', { name: 'Move to…' });
    await expect(submenu).toBeVisible();
    const box = await submenu.boundingBox();
    const viewport = panel.viewportSize();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);

    await submenu.getByRole('menuitem', { name: 'Work' }).click();

    await expect(menu).toBeHidden();
    await expect(
      panel.getByRole('list', { name: 'Work content' }).getByRole('button', { name: 'Mail' }),
    ).toBeVisible();
  });
}
