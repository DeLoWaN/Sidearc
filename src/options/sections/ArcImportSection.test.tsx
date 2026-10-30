import { readFileSync } from 'node:fs';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { ArcImportResult } from '../../shared/arc-import';
import { MAX_FAVORITES } from '../../shared/item-tree';
import { type Ask, OptionsContext } from '../options-context';
import { ArcImportSection } from './ArcImportSection';

const fixture = readFileSync('tests/fixtures/arc/StorableSidebar.trimmed.json', 'utf8');
const ALPHA = 'thebrowser.company.defaultPersonalSpaceID';
const BETA = '11111111-2222-4333-8444-555555555555';
const ARC_PATH = '~/Library/Application Support/Arc/StorableSidebar.json';

const REPORT: ArcImportResult = {
  ok: true,
  report: { favorites: 3, pinnedTabs: 9, folders: 5, favoritesIgnored: 0, skipped: 0 },
};

afterEach(() => vi.useRealTimers());

/** Renders the section with a fake worker that answers the two Arc import requests. */
function renderSection({
  itemCount = 0,
  result = REPORT,
}: {
  itemCount?: number;
  result?: ArcImportResult;
} = {}) {
  const ask = vi.fn(async (rpc: string) => {
    if (rpc === 'arc-import/status') return { itemCount };
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
  userEvent.upload(screen.getByLabelText('Arc sidebar file'), file);
const chooseSpace = async (id: string) =>
  userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Arc space' }), id);
const importRuns = (ask: ReturnType<typeof renderSection>['ask']) =>
  ask.mock.calls.filter(([rpc]) => rpc === 'arc-import/run');

// --- the guide

it('is always on the page, whatever Sidearc holds', () => {
  renderSection({ itemCount: 12 });

  expect(screen.getByRole('heading', { name: 'Import from Arc' })).toBeVisible();
  expect(screen.getByLabelText('Arc sidebar file')).toHaveAttribute('type', 'file');
});

it('explains the import in four numbered steps', () => {
  renderSection();

  const steps = within(screen.getByRole('list')).getAllByRole('listitem');

  expect(steps).toHaveLength(4);
  expect(steps[0]).toHaveTextContent(
    'Sidearc reads the file where Arc keeps your sidebar. Arc can stay open.',
  );
  expect(steps[1]).toHaveTextContent('Click Choose Arc file.');
  expect(steps[1]).toHaveTextContent(
    'In the file window, press ⌘ Shift G, paste the path below, press Enter, then click Open.',
  );
  expect(steps[2]).toHaveTextContent('Pick the Arc space to import.');
  expect(steps[2]).toHaveTextContent('Sidearc imports one space.');
  expect(steps[2]).toHaveTextContent(
    "Each Chrome profile has its own Sidearc data, so import 'Perso' in your Perso profile and 'IWD' in your IWD profile.",
  );
  expect(steps[3]).toHaveTextContent('Click Import.');
  expect(steps[3]).toHaveTextContent(
    'Sidearc shows how many Favorites, Pinned Tabs and Folders it imported.',
  );
});

it('says what the import takes and what it leaves', () => {
  renderSection();

  expect(
    screen.getByText(/Pinned Tabs and Folders of the space, with their nesting/),
  ).toHaveTextContent(
    `Imported: the Pinned Tabs and Folders of the space, with their nesting, and the Favorites of the matching Arc profile (${MAX_FAVORITES} at most).`,
  );
  expect(screen.getByText(/^Not imported:/)).toHaveTextContent(
    "Not imported: Arc's Unpinned Tabs, Live Folders, notes and easels.",
  );
});

it('shows the path of the Arc file in a box, next to the step that needs it', () => {
  renderSection();

  const step = within(screen.getByRole('list')).getAllByRole('listitem')[1] as HTMLElement;

  expect(within(step).getByText(ARC_PATH)).toBeVisible();
  expect(within(step).getByRole('button', { name: 'Choose Arc file' })).toBeVisible();
});

it('copies the exact path to the clipboard and says "Copied" for two seconds', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderSection();

  await user.click(screen.getByRole('button', { name: 'Copy path' }));

  expect(await navigator.clipboard.readText()).toBe(ARC_PATH);
  expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible();
  await act(() => vi.advanceTimersByTimeAsync(1900));
  expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible();
  await act(() => vi.advanceTimersByTimeAsync(200));
  expect(screen.getByRole('button', { name: 'Copy path' })).toBeVisible();
});

it('tells the user to copy the path by hand when the clipboard refuses', async () => {
  const user = userEvent.setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Denied'));
  renderSection();

  await user.click(screen.getByRole('button', { name: 'Copy path' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Sidearc could not copy the path. Select it and copy it by hand.',
  );
});

it('opens the file picker from the Choose Arc file button', async () => {
  const opened: string[] = [];
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
    this: HTMLInputElement,
  ) {
    opened.push(this.type);
  });
  renderSection();

  await userEvent.click(screen.getByRole('button', { name: 'Choose Arc file' }));

  expect(opened).toEqual(['file']);
});

// --- the space and the import

it('lists the spaces of the chosen file and keeps the import button off until a space is chosen', async () => {
  renderSection();
  expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  expect(screen.queryByRole('combobox', { name: 'Arc space' })).not.toBeInTheDocument();

  await chooseFile(arcFile());

  const picker = await screen.findByRole('combobox', { name: 'Arc space' });
  expect(Array.from(picker.querySelectorAll('option')).map((option) => option.textContent)).toEqual(
    ['Choose a space', 'Alpha', 'Beta'],
  );
  expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
});

it('counts the Pinned Tabs and Folders of the chosen space', async () => {
  renderSection();
  await chooseFile(arcFile());

  await chooseSpace(ALPHA);
  expect(screen.getByText(/in this space/)).toHaveTextContent('9 Pinned Tabs and 5 Folders');

  await chooseSpace(BETA);
  expect(screen.getByText(/in this space/)).toHaveTextContent('1 Pinned Tab and 1 Folder');
});

it('imports into an empty Sidearc without a question, then shows the counts', async () => {
  const { ask } = renderSection({ itemCount: 0 });
  await chooseFile(arcFile());
  await chooseSpace(ALPHA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(ask).toHaveBeenCalledWith('arc-import/run', { text: fixture, spaceId: ALPHA });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  const report = await screen.findByRole('status');
  expect(report).toHaveTextContent('3 Favorites');
  expect(report).toHaveTextContent('9 Pinned Tabs');
  expect(report).toHaveTextContent('5 Folders');
});

it('asks before it replaces the items, with their number and the name of the space', async () => {
  const { ask } = renderSection({ itemCount: 7 });
  await chooseFile(arcFile());
  await chooseSpace(BETA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  const dialog = await screen.findByRole('alertdialog', {
    name: 'Replace your Favorites, Pinned Tabs and Folders?',
  });
  expect(dialog).toHaveTextContent(
    'Replace your Favorites, Pinned Tabs and Folders? Sidearc has 7 items now. The import replaces them with the Arc space "Beta". Export a backup first if you want to keep them.',
  );
  expect(within(dialog).getByRole('button', { name: 'Replace my data' })).toBeVisible();
  expect(importRuns(ask)).toHaveLength(0);
});

it('changes nothing when the user cancels the question', async () => {
  const { ask } = renderSection({ itemCount: 7 });
  await chooseFile(arcFile());
  await chooseSpace(ALPHA);
  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(importRuns(ask)).toHaveLength(0);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
});

it('replaces the items and shows the counts when the user confirms', async () => {
  const { ask } = renderSection({ itemCount: 7 });
  await chooseFile(arcFile());
  await chooseSpace(ALPHA);
  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  await userEvent.click(await screen.findByRole('button', { name: 'Replace my data' }));

  expect(importRuns(ask)).toEqual([['arc-import/run', { text: fixture, spaceId: ALPHA }]]);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent('9 Pinned Tabs');
});

it('reads the number of items again at each click, so a pin made meanwhile is not lost', async () => {
  let itemCount = 0;
  const ask = vi.fn(async (rpc: string) => {
    if (rpc === 'arc-import/status') return { itemCount };
    return REPORT;
  });
  render(
    <OptionsContext value={ask as unknown as Ask}>
      <ArcImportSection />
    </OptionsContext>,
  );
  await chooseFile(arcFile());
  await chooseSpace(ALPHA);

  itemCount = 1;
  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Sidearc has 1 item now.');
});

it('mentions the Favorites left out and the items skipped in the report', async () => {
  renderSection({
    result: {
      ok: true,
      report: { favorites: 12, pinnedTabs: 1, folders: 1, favoritesIgnored: 2, skipped: 4 },
    },
  });
  await chooseFile(arcFile());
  await chooseSpace(BETA);

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
  expect(importRuns(ask)).toHaveLength(0);
});

it('shows the error of the worker when it refuses the import', async () => {
  renderSection({ result: { ok: false, error: 'The Arc item "x" appears twice in the tree.' } });
  await chooseFile(arcFile());
  await chooseSpace(ALPHA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The Arc item "x" appears twice in the tree.',
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('shows an error when the worker does not answer the status request', async () => {
  const ask = vi.fn(async () => {
    throw new Error('Worker is asleep');
  });
  render(
    <OptionsContext value={ask as unknown as Ask}>
      <ArcImportSection />
    </OptionsContext>,
  );
  await chooseFile(arcFile());
  await chooseSpace(ALPHA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Worker is asleep');
});

it('shows an error when the import request fails', async () => {
  const ask = vi.fn(async (rpc: string) => {
    if (rpc === 'arc-import/status') return { itemCount: 0 };
    throw new Error('Worker is gone');
  });
  render(
    <OptionsContext value={ask as unknown as Ask}>
      <ArcImportSection />
    </OptionsContext>,
  );
  await chooseFile(arcFile());
  await chooseSpace(ALPHA);

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
  await chooseSpace(ALPHA);

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(await screen.findByRole('status')).toHaveTextContent(
    `Sidearc keeps ${MAX_FAVORITES} Favorites at most`,
  );
});
