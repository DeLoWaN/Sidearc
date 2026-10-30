import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { makeItem, makeState } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import { resetPanelStore } from '../store';
import { resetPanelUi } from '../ui-store';
import { Overlays } from './Overlays';
import { PinnedSection } from './PinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

/** The section with the overlays, because the right-click menu is an overlay. */
function renderPinned(options?: Parameters<typeof renderPanel>[1]) {
  return renderPanel(
    <>
      <PinnedSection />
      <Overlays />
    </>,
    options,
  );
}

it('lists the Pinned Tabs in the order of the state, with title and site icon', () => {
  const state = makeState({
    items: [
      makeItem({ title: 'Mail', iconUrl: 'https://mail.test/icon.png' }),
      makeItem({ title: 'Calendar', iconUrl: 'https://calendar.test/icon.png' }),
    ],
  });
  renderPinned({ state });

  const rows = screen.getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual(['Mail', 'Calendar']);
  expect(rows[0]?.querySelector('img')).toHaveAttribute('src', 'https://mail.test/icon.png');
});

it('shows a Pinned Tab with an open live tab differently from one at rest', () => {
  const state = makeState({
    items: [makeItem({ title: 'Mail' }), makeItem({ title: 'Calendar', live: { tabId: 7 } })],
  });
  renderPinned({ state });

  const [rest, live] = screen.getAllByRole('listitem') as [HTMLElement, HTMLElement];
  expect(rest).not.toHaveAttribute('data-live');
  expect(live).toHaveAttribute('data-live');
  expect(within(rest).queryByRole('button', { name: 'Close Mail' })).toBeNull();
  expect(within(live).getByRole('button', { name: 'Close Calendar' })).toBeVisible();
});

it('asks the worker to open the item when the user clicks a Pinned Tab', async () => {
  const item = makeItem({ title: 'Mail' });
  const { send } = renderPinned({ state: makeState({ items: [item] }) });

  await userEvent.click(screen.getByRole('button', { name: 'Mail' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/open', itemId: item.id });
});

it('asks the worker to close the live tab when the user clicks the close button', async () => {
  const item = makeItem({ title: 'Mail', live: { tabId: 7 } });
  const { send } = renderPinned({ state: makeState({ items: [item] }) });

  await userEvent.click(screen.getByRole('button', { name: 'Close Mail' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'tab/close', tabId: 7 });
});

it('highlights the live tab that is on screen in the window of the panel', () => {
  const state = makeState({
    items: [
      makeItem({ title: 'Mail', live: { tabId: 1, windowId: 1, active: true } }),
      makeItem({ title: 'Calendar', live: { tabId: 2, windowId: 1, active: false } }),
      makeItem({ title: 'Wiki', live: { tabId: 3, windowId: 2, active: true } }),
    ],
  });
  renderPinned({ state, windowId: 1 });

  expect(screen.getByRole('button', { name: 'Mail' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: 'Calendar' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('button', { name: 'Wiki' })).not.toHaveAttribute('aria-current');
});

it('shows the saved title, a "/" and the current title after the live tab navigated away', () => {
  const state = makeState({
    items: [makeItem({ title: 'Inbox', live: { title: 'Mail 42', away: true } })],
  });
  renderPinned({ state });

  const row = screen.getByRole('listitem');
  expect(row).toHaveTextContent(/^Inbox\s*\/\s*Mail 42$/);
  expect(within(row).getByRole('button', { name: 'Reset Inbox' })).toBeVisible();
});

it('shows only the saved title, and no Reset button, while the live tab is on the saved URL', () => {
  const state = makeState({
    items: [makeItem({ title: 'Inbox', live: { title: 'Inbox (3)', away: false } })],
  });
  renderPinned({ state });

  expect(screen.getByRole('listitem')).toHaveTextContent(/^Inbox$/);
  expect(screen.queryByRole('button', { name: /Reset/ })).toBeNull();
});

it('asks the worker to reset the item when the user clicks Reset', async () => {
  const item = makeItem({ title: 'Inbox', live: { away: true } });
  const { send } = renderPinned({ state: makeState({ items: [item] }) });

  await userEvent.click(screen.getByRole('button', { name: 'Reset Inbox' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/reset', itemId: item.id });
});

function openMenu(title: string) {
  fireEvent.contextMenu(screen.getByRole('button', { name: new RegExp(`^${title}`) }));
  return screen.getByRole('menu');
}

it('offers rename, Reset, copy URL and delete in a right-click menu', () => {
  renderPinned({ state: makeState({ items: [makeItem({ title: 'Mail', live: { tabId: 7 } })] }) });

  const menu = openMenu('Mail');

  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent),
  ).toEqual(['Rename', 'Reset', 'Copy URL', 'Delete']);
});

it('resets the item from the right-click menu and closes the menu', async () => {
  const item = makeItem({ title: 'Mail', live: { tabId: 7 } });
  const { send } = renderPinned({ state: makeState({ items: [item] }) });

  await userEvent.click(within(openMenu('Mail')).getByRole('menuitem', { name: 'Reset' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/reset', itemId: item.id });
  expect(screen.queryByRole('menu')).toBeNull();
});

it('copies the saved URL from the right-click menu', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  const item = makeItem({ title: 'Mail', url: 'https://mail.test/inbox' });
  renderPinned({ state: makeState({ items: [item] }) });

  await userEvent.click(within(openMenu('Mail')).getByRole('menuitem', { name: 'Copy URL' }));

  expect(writeText).toHaveBeenCalledExactlyOnceWith('https://mail.test/inbox');
  expect(screen.queryByRole('menu')).toBeNull();
  vi.unstubAllGlobals();
});

it('deletes the item from the right-click menu', async () => {
  const item = makeItem({ title: 'Mail' });
  const { send } = renderPinned({ state: makeState({ items: [item] }) });

  await userEvent.click(within(openMenu('Mail')).getByRole('menuitem', { name: 'Delete' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/delete', itemId: item.id });
});

it('renames the item in place from the right-click menu', async () => {
  const item = makeItem({ title: 'Mail' });
  const { send } = renderPinned({ state: makeState({ items: [item] }) });

  await userEvent.click(within(openMenu('Mail')).getByRole('menuitem', { name: 'Rename' }));
  const field = screen.getByRole('textbox', { name: 'Name of Mail' });
  expect(field).toHaveValue('Mail');
  await userEvent.clear(field);
  await userEvent.type(field, 'Work mail{Enter}');

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'item/rename',
    itemId: item.id,
    title: 'Work mail',
  });
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('sends nothing when the user cancels a rename or leaves the name blank', async () => {
  const item = makeItem({ title: 'Mail' });
  const { send } = renderPinned({ state: makeState({ items: [item] }) });

  await userEvent.click(within(openMenu('Mail')).getByRole('menuitem', { name: 'Rename' }));
  await userEvent.type(screen.getByRole('textbox'), 'xyz{Escape}');
  expect(screen.queryByRole('textbox')).toBeNull();

  await userEvent.click(within(openMenu('Mail')).getByRole('menuitem', { name: 'Rename' }));
  await userEvent.clear(screen.getByRole('textbox'));
  await userEvent.type(screen.getByRole('textbox'), '   {Enter}');

  expect(send).not.toHaveBeenCalled();
});

it('closes the right-click menu on Escape', async () => {
  renderPinned({ state: makeState({ items: [makeItem({ title: 'Mail' })] }) });
  openMenu('Mail');

  await userEvent.keyboard('{Escape}');

  expect(screen.queryByRole('menu')).toBeNull();
});
