import { expect, test } from './fixtures';

// Playwright cannot drive the real side panel, so the panel page runs in a normal tab.

test('a middle click on a tab row closes the Chrome tab', async ({
  context,
  extensionId,
  serviceWorker,
  site,
}) => {
  const form = await context.newPage();
  await form.goto(`${site.origin}/form`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const formRow = panel.getByRole('button', { name: 'form', exact: true });

  await formRow.click({ button: 'middle' });

  await expect(formRow).toBeHidden();
  const titles = await serviceWorker.evaluate(async () =>
    (await chrome.tabs.query({})).map((tab) => tab.title),
  );
  expect(titles).not.toContain('form');
});

test('the panel shows the open tabs, activates one and closes one', async ({
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

  const formRow = panel.getByRole('button', { name: 'form', exact: true });
  const otherRow = panel.getByRole('button', { name: 'other', exact: true });
  await expect(formRow).toBeVisible();
  await expect(otherRow).toBeVisible();
  // The panel page is the tab on screen in its window.
  await expect(panel.getByRole('button', { name: 'Sidearc', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );

  await otherRow.click();
  await expect
    .poll(() =>
      serviceWorker.evaluate(async () => (await chrome.tabs.query({ active: true }))[0]?.title),
    )
    .toBe('other');

  await panel.getByRole('button', { name: 'Close form' }).click();
  await expect(formRow).toBeHidden();
  const titles = await serviceWorker.evaluate(async () =>
    (await chrome.tabs.query({})).map((tab) => tab.title),
  );
  expect(titles).not.toContain('form');
});
