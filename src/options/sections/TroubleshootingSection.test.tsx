import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderOptions } from '../../../tests/support/render-options';
import type { PlacementLogEntry } from '../../shared/protocol';
import { TroubleshootingSection } from './TroubleshootingSection';

const entry: PlacementLogEntry = {
  time: '2026-10-30T18:30:00.000Z',
  event: 'created',
  tabId: 12,
  windowId: 3,
  index: 5,
  openerTabId: 7,
  url: '',
  pendingUrl: 'chrome://newtab/',
  status: 'loading',
  active: true,
  decision: 'move',
  reason: 'A New Tab page that the user opened',
  moveResult: 'moved',
};

const LINE =
  '2026-10-30T18:30:00.000Z created tab=12 window=3 index=5 opener=7 url="" pending="chrome://newtab/" status=loading active=true -> move: A New Tab page that the user opened (moved)';

it('keeps the log closed and unread until the user opens it', async () => {
  const { ask } = renderOptions(<TroubleshootingSection />, {
    answers: { 'diagnostics/get': () => [entry] },
  });

  expect(screen.getByText('Troubleshooting').closest('details')).not.toHaveAttribute('open');
  expect(ask).not.toHaveBeenCalled();
});

it('shows each entry as one line of text once the user opens the block', async () => {
  renderOptions(<TroubleshootingSection />, { answers: { 'diagnostics/get': () => [entry] } });

  await userEvent.click(screen.getByText('Troubleshooting'));

  expect(await screen.findByLabelText('Log of new tabs')).toHaveTextContent(LINE);
});

it('shows a short text when the log is empty, and does not offer to copy it', async () => {
  renderOptions(<TroubleshootingSection />, { answers: { 'diagnostics/get': () => [] } });

  await userEvent.click(screen.getByText('Troubleshooting'));

  expect(await screen.findByText('Nothing recorded yet.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
});

it('copies the text of the log', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  renderOptions(<TroubleshootingSection />, { answers: { 'diagnostics/get': () => [entry] } });
  await userEvent.click(screen.getByText('Troubleshooting'));
  await screen.findByLabelText('Log of new tabs');

  await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

  expect(writeText).toHaveBeenCalledWith(LINE);
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeVisible();
  vi.unstubAllGlobals();
});

it('reads the log again when the user presses Refresh', async () => {
  let entries = [entry];
  renderOptions(<TroubleshootingSection />, { answers: { 'diagnostics/get': () => entries } });
  await userEvent.click(screen.getByText('Troubleshooting'));
  await screen.findByLabelText('Log of new tabs');

  entries = [];
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

  expect(await screen.findByText('Nothing recorded yet.')).toBeVisible();
});

it('shows the error when the worker cannot give the log', async () => {
  renderOptions(<TroubleshootingSection />, {
    answers: {
      'diagnostics/get': () => {
        throw new Error('Worker is asleep');
      },
    },
  });

  await userEvent.click(screen.getByText('Troubleshooting'));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The log could not be read: Worker is asleep',
  );
});
