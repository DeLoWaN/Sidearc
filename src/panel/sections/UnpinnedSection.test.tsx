import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import { resetPanelStore } from '../store';
import { UnpinnedSection } from './UnpinnedSection';

beforeEach(resetPanelStore);

it('lists the tabs in the order of the state, with title and site icon', () => {
  const state = makeState({
    unpinnedTabs: [
      makeTab({ title: 'Mail', iconUrl: 'https://mail.test/icon.png' }),
      makeTab({ title: 'Calendar', iconUrl: 'https://calendar.test/icon.png' }),
    ],
  });
  renderPanel(<UnpinnedSection />, { state });

  const rows = screen.getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual(['Mail', 'Calendar']);
  expect(rows[0]?.querySelector('img')).toHaveAttribute('src', 'https://mail.test/icon.png');
  expect(rows[1]?.querySelector('img')).toHaveAttribute('src', 'https://calendar.test/icon.png');
});

it('shows the first letter of the title when the icon does not load', () => {
  const state = makeState({
    unpinnedTabs: [makeTab({ title: 'Mail', iconUrl: 'https://x.test/i' })],
  });
  renderPanel(<UnpinnedSection />, { state });

  const icon = screen.getByRole('listitem').querySelector('img') as HTMLImageElement;
  fireEvent.error(icon);

  expect(screen.getByRole('listitem').querySelector('img')).toBeNull();
  expect(screen.getByText('M')).toBeVisible();
});

it('highlights the active tab of the window that holds the panel', () => {
  const state = makeState({
    unpinnedTabs: [
      makeTab({ title: 'Mail', windowId: 1, active: true }),
      makeTab({ title: 'Calendar', windowId: 1 }),
      makeTab({ title: 'Wiki', windowId: 2, active: true }),
    ],
  });
  renderPanel(<UnpinnedSection />, { state, windowId: 1 });

  expect(screen.getByRole('button', { name: 'Mail' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: 'Calendar' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('button', { name: 'Wiki' })).not.toHaveAttribute('aria-current');
});

it('asks the worker to show a tab when the user clicks it', async () => {
  const tab = makeTab({ title: 'Mail' });
  const { send } = renderPanel(<UnpinnedSection />, { state: makeState({ unpinnedTabs: [tab] }) });

  await userEvent.click(screen.getByRole('button', { name: 'Mail' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'tab/activate', tabId: tab.id });
});

it('asks the worker to close a tab when the user clicks its close button', async () => {
  const tab = makeTab({ title: 'Mail' });
  const { send } = renderPanel(<UnpinnedSection />, { state: makeState({ unpinnedTabs: [tab] }) });

  await userEvent.click(screen.getByRole('button', { name: 'Close Mail' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'tab/close', tabId: tab.id });
});
