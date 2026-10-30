import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { makeArchiveEntry, makeState } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import { App } from '../App';
import { resetArchiveUi } from '../archive-ui-store';
import { resetPanelStore, usePanelStore } from '../store';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

beforeEach(() => {
  resetPanelStore();
  resetArchiveUi();
});

/** Renders the panel with these archived tabs and opens View Archive from the bottom bar. */
async function openViewArchive(archive = [makeArchiveEntry()]) {
  const rendered = renderPanel(<App />, { state: makeState({ archive }) });
  await userEvent.click(screen.getByRole('button', { name: 'View Archive' }));
  return { ...rendered, view: screen.getByRole('dialog', { name: 'View Archive' }) };
}

it('opens View Archive from a button at the bottom of the panel', async () => {
  renderPanel(<App />);
  expect(screen.queryByRole('dialog', { name: 'View Archive' })).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'View Archive' }));

  expect(screen.getByRole('dialog', { name: 'View Archive' })).toBeVisible();
});

it('shows the title, the site icon and the closing time of each tab', async () => {
  const now = Date.now();
  const { view } = await openViewArchive([
    makeArchiveEntry({
      title: 'Mail',
      iconUrl: 'https://mail.test/icon.png',
      closedAt: now - 3 * HOUR - MINUTE,
    }),
    makeArchiveEntry({ title: 'Wiki', closedAt: now - 2 * DAY - HOUR }),
    makeArchiveEntry({ title: 'Docs', closedAt: now - 5 * MINUTE }),
    makeArchiveEntry({ title: 'News', closedAt: now - 10_000 }),
  ]);

  const rows = within(view).getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual([
    'Mail3 hours ago',
    'Wiki2 days ago',
    'Docs5 minutes ago',
    'Newsjust now',
  ]);
  expect(rows[0]?.querySelector('img')).toHaveAttribute('src', 'https://mail.test/icon.png');
});

it('shows the first letter of the title when the icon does not load', async () => {
  const { view } = await openViewArchive([makeArchiveEntry({ title: 'Mail', iconUrl: '' })]);
  expect(within(view).getByText('M')).toBeVisible();
});

it('says so when nothing is archived', async () => {
  const { view } = await openViewArchive([]);
  expect(view).toHaveTextContent('No archived tabs');
});

it('filters the list by title as the user types, ignoring case', async () => {
  const { view } = await openViewArchive([
    makeArchiveEntry({ title: 'Mail inbox' }),
    makeArchiveEntry({ title: 'Wiki' }),
  ]);

  await userEvent.type(within(view).getByRole('searchbox', { name: 'Search archive' }), 'INBOX');

  expect(
    within(view)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual([expect.stringContaining('Mail inbox')]);
});

it('filters the list by URL', async () => {
  const { view } = await openViewArchive([
    makeArchiveEntry({ title: 'First', url: 'https://jira.example.com/PLAT-1' }),
    makeArchiveEntry({ title: 'Second', url: 'https://wiki.example.com/page' }),
  ]);

  await userEvent.type(within(view).getByRole('searchbox', { name: 'Search archive' }), 'JIRA');

  expect(
    within(view)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual([expect.stringContaining('First')]);
});

it('says so when no tab matches the search', async () => {
  const { view } = await openViewArchive([makeArchiveEntry({ title: 'Mail' })]);

  await userEvent.type(within(view).getByRole('searchbox', { name: 'Search archive' }), 'zzz');

  expect(within(view).queryAllByRole('listitem')).toHaveLength(0);
  expect(view).toHaveTextContent('No match');
});

it('asks the worker to reopen the tab that the user clicks, and closes View Archive', async () => {
  const entry = makeArchiveEntry({ title: 'Mail' });
  const { send, view } = await openViewArchive([makeArchiveEntry({ title: 'Wiki' }), entry]);

  await userEvent.click(within(view).getByRole('button', { name: /Mail/ }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'archive/reopen', entryId: entry.id });
  expect(screen.queryByRole('dialog', { name: 'View Archive' })).toBeNull();
});

it('closes with its close button and with Escape', async () => {
  await openViewArchive();
  await userEvent.click(screen.getByRole('button', { name: 'Close View Archive' }));
  expect(screen.queryByRole('dialog', { name: 'View Archive' })).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'View Archive' }));
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'View Archive' })).toBeNull();
});

it('starts with an empty search each time it opens', async () => {
  const { view } = await openViewArchive([makeArchiveEntry({ title: 'Mail' })]);
  await userEvent.type(within(view).getByRole('searchbox', { name: 'Search archive' }), 'zzz');
  await userEvent.click(screen.getByRole('button', { name: 'Close View Archive' }));

  await userEvent.click(screen.getByRole('button', { name: 'View Archive' }));

  expect(screen.getByRole('searchbox', { name: 'Search archive' })).toHaveValue('');
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
});

it('shows a tab that the worker archives while View Archive is open', async () => {
  const { view } = await openViewArchive([]);

  act(() =>
    usePanelStore
      .getState()
      .receive(makeState({ archive: [makeArchiveEntry({ title: 'Late tab' })] })),
  );

  expect(within(view).getByRole('button', { name: /Late tab/ })).toBeVisible();
});
