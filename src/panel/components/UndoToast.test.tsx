import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderPanel } from '../../../tests/support/render-panel';
import { resetPanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';
import { UndoToast } from './UndoToast';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resetPanelStore();
  resetPanelUi();
});
afterEach(() => vi.useRealTimers());

it('shows nothing until an action asks for the toast', () => {
  renderPanel(<UndoToast />);
  expect(screen.queryByRole('status')).toBeNull();
});

it('shows the message with an Undo button that sends undo and hides the toast', async () => {
  const { send } = renderPanel(<UndoToast />);

  act(() => usePanelUi.getState().showUndoToast('Deleted "Mail"'));
  expect(screen.getByRole('status')).toHaveTextContent('Deleted "Mail"');

  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'undo' });
  expect(screen.queryByRole('status')).toBeNull();
});

it('hides after 8 seconds, and not before', () => {
  renderPanel(<UndoToast />);
  act(() => usePanelUi.getState().showUndoToast('Deleted "Mail"'));

  act(() => vi.advanceTimersByTime(7999));
  expect(screen.getByRole('status')).toBeVisible();

  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole('status')).toBeNull();
});

it('starts the 8 seconds again for a new message', () => {
  renderPanel(<UndoToast />);
  act(() => usePanelUi.getState().showUndoToast('Deleted "Mail"'));
  act(() => vi.advanceTimersByTime(5000));

  act(() => usePanelUi.getState().showUndoToast('Deleted "Wiki"'));
  act(() => vi.advanceTimersByTime(5000));

  expect(screen.getByRole('status')).toHaveTextContent('Deleted "Wiki"');
});

it('hides when the user dismisses it', async () => {
  renderPanel(<UndoToast />);
  act(() => usePanelUi.getState().showUndoToast('Deleted "Mail"'));

  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

  expect(screen.queryByRole('status')).toBeNull();
});
