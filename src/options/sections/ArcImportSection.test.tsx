import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { ArcImportResult } from '../../shared/arc-import';
import { MAX_FAVORITES } from '../../shared/item-tree';
import { type Ask, OptionsContext } from '../options-context';
import { ArcImportSection } from './ArcImportSection';

const fixture = readFileSync('tests/fixtures/arc/StorableSidebar.trimmed.json', 'utf8');
const ALPHA = 'thebrowser.company.defaultPersonalSpaceID';
const BETA = '11111111-2222-4333-8444-555555555555';

const REPORT: ArcImportResult = {
  ok: true,
  report: { favorites: 3, pinnedTabs: 9, folders: 5, favoritesIgnored: 0, skipped: 0 },
};

/** Renders the section with a fake worker that answers the two Arc import requests. */
function renderSection({
  available = true,
  result = REPORT,
}: {
  available?: boolean;
  result?: ArcImportResult;
} = {}) {
  const ask = vi.fn(async (rpc: string) => {
    if (rpc === 'arc-import/available') return available;
    if (rpc === 'arc-import/run') return result;
    throw new Error(`Unexpected request: ${rpc}`);
  });
  render(
    <OptionsContext value={ask as unknown as Ask}>
      <ArcImportSection />
    </OptionsContext>,
  );
  return { ask };
}

const arcFile = (text = fixture) =>
  new File([text], 'StorableSidebar.json', { type: 'application/json' });
const chooseFile = async (file: File) =>
  userEvent.upload(await screen.findByLabelText('Arc sidebar file'), file);

it('offers the import when Sidearc has no items', async () => {
  renderSection();

  expect(await screen.findByRole('heading', { name: 'Import from Arc' })).toBeVisible();
  expect(screen.getByLabelText('Arc sidebar file')).toHaveAttribute('type', 'file');
});

it('opens the file picker from a button', async () => {
  const opened: string[] = [];
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
    this: HTMLInputElement,
  ) {
    opened.push(this.type);
  });
  renderSection();

  await userEvent.click(await screen.findByRole('button', { name: 'Choose file' }));

  expect(opened).toEqual(['file']);
});

it('offers nothing when Sidearc has items', async () => {
  const { ask } = renderSection({ available: false });

  await vi.waitFor(() => expect(ask).toHaveBeenCalledWith('arc-import/available', null));

  expect(screen.queryByRole('heading', { name: 'Import from Arc' })).not.toBeInTheDocument();
});

it('lists the spaces of the chosen file and keeps the import button off until a space is chosen', async () => {
  renderSection();
  expect(await screen.findByRole('button', { name: 'Import' })).toBeDisabled();

  await chooseFile(arcFile());

  const picker = await screen.findByRole('combobox', { name: 'Arc space' });
  expect(Array.from(picker.querySelectorAll('option')).map((option) => option.textContent)).toEqual(
    ['Choose a space', 'Alpha', 'Beta'],
  );
  expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
});

it('sends the file text and the chosen space to the worker, then shows the counts', async () => {
  const { ask } = renderSection();
  await chooseFile(arcFile());
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Arc space' }), ALPHA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(ask).toHaveBeenCalledWith('arc-import/run', { text: fixture, spaceId: ALPHA });
  const report = await screen.findByRole('status');
  expect(report).toHaveTextContent('3 Favorites');
  expect(report).toHaveTextContent('9 Pinned Tabs');
  expect(report).toHaveTextContent('5 Folders');
  expect(screen.queryByLabelText('Arc sidebar file')).not.toBeInTheDocument();
});

it('mentions the Favorites left out and the items skipped in the report', async () => {
  renderSection({
    result: {
      ok: true,
      report: { favorites: 12, pinnedTabs: 1, folders: 1, favoritesIgnored: 2, skipped: 4 },
    },
  });
  await chooseFile(arcFile());
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Arc space' }), BETA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  const report = await screen.findByRole('status');
  expect(report).toHaveTextContent('2 Favorites left out');
  expect(report).toHaveTextContent('4 Arc-only items skipped');
});

it('refuses a file that is not an Arc sidebar with the precise error and sends nothing', async () => {
  const { ask } = renderSection();

  await chooseFile(arcFile('{"hello":"world"}'));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This is not an Arc sidebar file: "sidebar.containers" is missing.',
  );
  expect(screen.queryByRole('combobox', { name: 'Arc space' })).not.toBeInTheDocument();
  expect(ask).not.toHaveBeenCalledWith('arc-import/run', expect.anything());
});

it('shows the error of the worker when it refuses the import', async () => {
  renderSection({ result: { ok: false, error: 'Sidearc already has items.' } });
  await chooseFile(arcFile());
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Arc space' }), ALPHA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Sidearc already has items.');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('shows an error when the worker does not answer the availability question', async () => {
  const ask = vi.fn(async () => {
    throw new Error('Worker is asleep');
  });
  render(
    <OptionsContext value={ask as unknown as Ask}>
      <ArcImportSection />
    </OptionsContext>,
  );

  expect(await screen.findByRole('alert')).toHaveTextContent('Worker is asleep');
});

it('shows an error when the import request fails', async () => {
  const ask = vi.fn(async (rpc: string) => {
    if (rpc === 'arc-import/available') return true;
    throw new Error('Worker is gone');
  });
  render(
    <OptionsContext value={ask as unknown as Ask}>
      <ArcImportSection />
    </OptionsContext>,
  );
  await chooseFile(arcFile());
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Arc space' }), ALPHA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Worker is gone');
});

it('names the Favorite limit with the shared constant', async () => {
  renderSection({
    result: {
      ok: true,
      report: { favorites: 12, pinnedTabs: 0, folders: 0, favoritesIgnored: 1, skipped: 0 },
    },
  });
  await chooseFile(arcFile());
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Arc space' }), ALPHA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(await screen.findByRole('status')).toHaveTextContent(
    `Sidearc keeps ${MAX_FAVORITES} Favorites at most`,
  );
});
