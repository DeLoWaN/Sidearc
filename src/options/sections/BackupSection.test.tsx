import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderOptions } from '../../../tests/support/render-options';
import type { BackupCheckResult } from '../../shared/protocol';
import { SettingsProvider } from '../settings-context';
import { BackupSection } from './BackupSection';

const SUMMARY = { favorites: 3, pinnedTabs: 12, folders: 4, archivedTabs: 7 };
const FILE_TEXT = '{"format":"sidearc-backup"}';

let created: Blob[];
let downloads: string[];

beforeEach(() => {
  created = [];
  downloads = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    created.push(blob);
    return 'blob:backup';
  });
  URL.revokeObjectURL = vi.fn();
  // The page clicks a link with a `download` name: the test keeps the name.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  vi.setSystemTime(new Date(2026, 2, 5, 14, 0));
});

afterEach(() => vi.useRealTimers());

const backupFile = (text = FILE_TEXT) =>
  new File([text], 'backup.json', { type: 'application/json' });

/** Renders the section with a fake worker that checks the file text like the real one. */
function renderBackup(
  check: (text: string) => BackupCheckResult = () => ({ ok: true, summary: SUMMARY }),
) {
  return renderOptions(
    <SettingsProvider>
      <BackupSection />
    </SettingsProvider>,
    {
      answers: {
        'backup/export': () => '{"exported":true}',
        'backup/inspect': (text) => check(text as string),
        'backup/import': (text) => check(text as string),
      },
    },
  );
}

it('downloads the text of the worker as a backup file named after the date', async () => {
  const { ask } = renderBackup();

  await userEvent.click(await screen.findByRole('button', { name: 'Export backup' }));

  await waitFor(() => expect(downloads).toEqual(['sidearc-backup-2026-03-05.json']));
  expect(ask).toHaveBeenCalledWith('backup/export', null);
  expect(await created[0]?.text()).toBe('{"exported":true}');
  expect(created[0]?.type).toBe('application/json');
});

it('shows the counts of the file and asks before it replaces the data', async () => {
  const { ask } = renderBackup();

  await userEvent.upload(await screen.findByLabelText('Backup file'), backupFile());

  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    '3 Favorites, 12 Pinned Tabs, 4 Folders and 7 archived tabs',
  );
  expect(ask).toHaveBeenCalledWith('backup/inspect', FILE_TEXT);
  expect(ask).not.toHaveBeenCalledWith('backup/import', expect.anything());
});

it('uses the singular for a count of one', async () => {
  renderBackup(() => ({
    ok: true,
    summary: { favorites: 1, pinnedTabs: 1, folders: 1, archivedTabs: 1 },
  }));

  await userEvent.upload(await screen.findByLabelText('Backup file'), backupFile());

  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    '1 Favorite, 1 Pinned Tab, 1 Folder and 1 archived tab',
  );
});

it('replaces the data after the user confirms, and tells the user', async () => {
  const { ask } = renderBackup();
  await userEvent.upload(await screen.findByLabelText('Backup file'), backupFile());

  await userEvent.click(await screen.findByRole('button', { name: 'Replace my data' }));

  expect(ask).toHaveBeenCalledWith('backup/import', FILE_TEXT);
  expect(await screen.findByRole('status')).toHaveTextContent('Backup imported');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('keeps the data when the user cancels', async () => {
  const { ask } = renderBackup();
  await userEvent.upload(await screen.findByLabelText('Backup file'), backupFile());

  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(ask).not.toHaveBeenCalledWith('backup/import', expect.anything());
});

it('keeps the data when the user presses Escape', async () => {
  const { ask } = renderBackup();
  await userEvent.upload(await screen.findByLabelText('Backup file'), backupFile());
  await screen.findByRole('alertdialog');

  await userEvent.keyboard('{Escape}');

  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(ask).not.toHaveBeenCalledWith('backup/import', expect.anything());
});

it('shows the precise error of the worker and asks nothing for a refused file', async () => {
  const error = 'Unknown backup version 2: this Sidearc reads version 1';
  const { ask } = renderBackup(() => ({ ok: false, error }));

  await userEvent.upload(await screen.findByLabelText('Backup file'), backupFile());

  expect(await screen.findByRole('alert')).toHaveTextContent(error);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(ask).not.toHaveBeenCalledWith('backup/import', expect.anything());
});

it('shows the error when the import is refused after the question', async () => {
  let calls = 0;
  renderBackup(() =>
    ++calls === 1 ? { ok: true, summary: SUMMARY } : { ok: false, error: 'Broke' },
  );
  await userEvent.upload(await screen.findByLabelText('Backup file'), backupFile());

  await userEvent.click(await screen.findByRole('button', { name: 'Replace my data' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Broke');
});

it('shows an error when the worker cannot check the file', async () => {
  renderBackup(() => {
    throw new Error('Worker is asleep');
  });

  await userEvent.upload(await screen.findByLabelText('Backup file'), backupFile());

  expect(await screen.findByRole('alert')).toHaveTextContent('Worker is asleep');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('shows an error when the import request fails after the question', async () => {
  let calls = 0;
  renderBackup(() => {
    if (++calls === 1) return { ok: true, summary: SUMMARY };
    throw new Error('Worker is gone');
  });
  await userEvent.upload(await screen.findByLabelText('Backup file'), backupFile());

  await userEvent.click(await screen.findByRole('button', { name: 'Replace my data' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Worker is gone');
});
