import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { makeState } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import { resetPanelStore } from '../store';
import { FooterBar } from './FooterBar';

beforeEach(resetPanelStore);

it('asks the worker to open the options page from the Options button', async () => {
  const { send } = renderPanel(<FooterBar />);

  await userEvent.click(screen.getByRole('button', { name: 'Options' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'options/open' });
});

it('shows a disabled Undo button when nothing can be undone', async () => {
  const { send } = renderPanel(<FooterBar />);

  const undo = screen.getByRole('button', { name: 'Undo' });
  expect(undo).toBeDisabled();
  expect(undo).toHaveAttribute('title', 'Nothing to undo');

  await userEvent.click(undo);
  expect(send).not.toHaveBeenCalled();
});

it('enables the Undo button and names the action it reverts in its title', async () => {
  const { send } = renderPanel(<FooterBar />, {
    state: makeState({ undo: { label: 'Delete "Mail"' } }),
  });

  const undo = screen.getByRole('button', { name: 'Undo' });
  expect(undo).toBeEnabled();
  expect(undo).toHaveAttribute('title', 'Undo Delete "Mail"');

  await userEvent.click(undo);
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'undo' });
});

it('sends one undo for each click', async () => {
  const { send } = renderPanel(<FooterBar />, {
    state: makeState({ undo: { label: 'Move "Mail"' } }),
  });

  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

  expect(send.mock.calls).toEqual([[{ type: 'undo' }], [{ type: 'undo' }]]);
});
