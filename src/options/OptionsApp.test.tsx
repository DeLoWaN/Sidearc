import { readFileSync } from 'node:fs';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { renderOptions } from '../../tests/support/render-options';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { OptionsApp } from './OptionsApp';

const cssVariable = (name: string) => document.documentElement.style.getPropertyValue(name);

it('shows the options page title', async () => {
  renderOptions(<OptionsApp />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Sidesweep options' })).toBeVisible();
});

// --- Arc import

const sectionTitles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

it('puts the Arc import first while Sidesweep is empty', async () => {
  renderOptions(<OptionsApp />, {
    answers: { 'arc-import/status': () => ({ itemCount: 0 }) },
  });

  await screen.findByRole('heading', { name: 'Import from Arc' });

  expect(sectionTitles()[0]).toBe('Import from Arc');
});

it('keeps the Arc import in its place, after the backup, once Sidesweep holds items', async () => {
  renderOptions(<OptionsApp />, {
    answers: { 'arc-import/status': () => ({ itemCount: 4 }) },
  });

  await screen.findByRole('heading', { name: 'Import from Arc' });

  const titles = sectionTitles();
  expect(titles[0]).toBe('Auto Archive');
  expect(titles.slice(-2)).toEqual(['Backup', 'Import from Arc']);
});

it('keeps the Arc import in its place when the worker cannot count the items', async () => {
  renderOptions(<OptionsApp />, {
    answers: {
      'arc-import/status': () => {
        throw new Error('Worker is asleep');
      },
    },
  });

  await screen.findByRole('heading', { name: 'Import from Arc' });

  expect(sectionTitles().at(-1)).toBe('Import from Arc');
});

it('does not move the Arc import after an import filled Sidesweep', async () => {
  let itemCount = 0;
  const report = { favorites: 0, pinnedTabs: 1, folders: 0, favoritesIgnored: 0, skipped: 0 };
  renderOptions(<OptionsApp />, {
    answers: {
      'arc-import/status': () => ({ itemCount }),
      'arc-import/run': () => {
        itemCount = 1;
        return { ok: true, report };
      },
    },
  });
  const fixture = readFileSync('tests/fixtures/arc/StorableSidebar.trimmed.json', 'utf8');
  await userEvent.upload(
    await screen.findByLabelText('Arc sidebar file'),
    new File([fixture], 'StorableSidebar.json'),
  );
  await userEvent.selectOptions(
    await screen.findByRole('combobox', { name: 'Arc space' }),
    'thebrowser.company.defaultPersonalSpaceID',
  );

  await userEvent.click(screen.getByRole('button', { name: 'Import' }));

  expect(await screen.findByRole('status')).toHaveTextContent('1 Pinned Tab');
  expect(sectionTitles()[0]).toBe('Import from Arc');
});

it('puts a closed Troubleshooting block at the bottom of the page', async () => {
  renderOptions(<OptionsApp />);
  await screen.findByRole('heading', { name: 'Import from Arc' });

  const blocks = [...document.querySelectorAll('main > *')];
  const last = blocks.at(-1);
  expect(last).toHaveTextContent('Troubleshooting');
  expect(last?.tagName).toBe('DETAILS');
  expect(last).not.toHaveAttribute('open');
});

// --- Auto Archive delay

it('shows the Auto Archive delay of the settings', async () => {
  renderOptions(<OptionsApp />, { settings: { ...DEFAULT_SETTINGS, autoArchiveHours: 36 } });
  expect(
    await screen.findByRole('spinbutton', { name: 'Auto Archive delay in hours' }),
  ).toHaveValue(36);
});

it('saves the delay when the user leaves the field', async () => {
  const { ask } = renderOptions(<OptionsApp />);
  const field = await screen.findByRole('spinbutton', { name: 'Auto Archive delay in hours' });

  await userEvent.clear(field);
  await userEvent.type(field, '24');
  expect(ask).not.toHaveBeenCalledWith('settings/save', expect.anything());
  await userEvent.tab();

  expect(ask).toHaveBeenCalledWith('settings/save', { autoArchiveHours: 24 });
});

it('saves the delay when the user presses Enter', async () => {
  const { ask } = renderOptions(<OptionsApp />);
  const field = await screen.findByRole('spinbutton', { name: 'Auto Archive delay in hours' });

  await userEvent.clear(field);
  await userEvent.type(field, '48{Enter}');

  expect(ask).toHaveBeenCalledWith('settings/save', { autoArchiveHours: 48 });
});

it('shows the error of the worker when it refuses the delay', async () => {
  const refuse = 'autoArchiveHours must be a whole number from 1 to 720, got 0';
  renderOptions(<OptionsApp />, { refuse });
  const field = await screen.findByRole('spinbutton', { name: 'Auto Archive delay in hours' });

  await userEvent.clear(field);
  await userEvent.type(field, '0');
  await userEvent.tab();

  expect(await screen.findByRole('alert')).toHaveTextContent(refuse);
});

// --- gradient and density

it('shows the density of the settings and saves another one', async () => {
  const { ask } = renderOptions(<OptionsApp />);
  expect(await screen.findByRole('radio', { name: 'Normal' })).toBeChecked();

  await userEvent.click(screen.getByRole('radio', { name: 'Compact' }));

  expect(ask).toHaveBeenCalledWith('settings/save', { density: 'compact' });
  expect(screen.getByRole('radio', { name: 'Compact' })).toBeChecked();
});

it('shows the gradient colours of the settings and saves another one', async () => {
  const { ask } = renderOptions(<OptionsApp />);
  const from = await screen.findByLabelText('Gradient start');
  const to = screen.getByLabelText('Gradient end');
  expect(from).toHaveValue(DEFAULT_SETTINGS.gradientFrom);
  expect(to).toHaveValue(DEFAULT_SETTINGS.gradientTo);

  fireEvent.change(from, { target: { value: '#112233' } });

  expect(ask).toHaveBeenCalledWith('settings/save', { gradientFrom: '#112233' });
});

// --- site groups

it('shows the site groups checkbox as checked by default and saves when the user clears it', async () => {
  const { ask } = renderOptions(<OptionsApp />);
  const box = await screen.findByRole('checkbox', { name: 'Group tabs opened from the same site' });
  expect(box).toBeChecked();

  await userEvent.click(box);

  expect(ask).toHaveBeenCalledWith('settings/save', { groupBySite: false });
  expect(box).not.toBeChecked();
});

it('shows the site groups checkbox as cleared when the setting is off', async () => {
  renderOptions(<OptionsApp />, { settings: { ...DEFAULT_SETTINGS, groupBySite: false } });

  expect(
    await screen.findByRole('checkbox', { name: 'Group tabs opened from the same site' }),
  ).not.toBeChecked();
});

// --- new tabs

it('shows the new tabs checkbox as checked by default and saves when the user clears it', async () => {
  const { ask } = renderOptions(<OptionsApp />);
  const box = await screen.findByRole('checkbox', { name: 'Open new tabs at the top of the list' });
  expect(box).toBeChecked();

  await userEvent.click(box);

  expect(ask).toHaveBeenCalledWith('settings/save', { newTabsOnTop: false });
  expect(box).not.toBeChecked();
});

it('shows the new tabs checkbox as cleared when the setting is off', async () => {
  renderOptions(<OptionsApp />, { settings: { ...DEFAULT_SETTINGS, newTabsOnTop: false } });

  expect(
    await screen.findByRole('checkbox', { name: 'Open new tabs at the top of the list' }),
  ).not.toBeChecked();
});

// --- gradient presets

it('saves both gradient colours when the user clicks a preset', async () => {
  const { ask } = renderOptions(<OptionsApp />);

  await userEvent.click(await screen.findByRole('button', { name: 'Sunset' }));

  expect(ask).toHaveBeenCalledWith('settings/save', {
    gradientFrom: '#f7b28c',
    gradientTo: '#f08fb0',
  });
  expect(screen.getByLabelText('Gradient start')).toHaveValue('#f7b28c');
  expect(screen.getByLabelText('Gradient end')).toHaveValue('#f08fb0');
});

it('marks the preset that matches the current colours as pressed', async () => {
  renderOptions(<OptionsApp />);

  expect(await screen.findByRole('button', { name: 'Lavender' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Sunset' })).toHaveAttribute('aria-pressed', 'false');

  await userEvent.click(screen.getByRole('button', { name: 'Sunset' }));

  expect(screen.getByRole('button', { name: 'Sunset' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Lavender' })).toHaveAttribute('aria-pressed', 'false');
});

it('marks no preset when the colours were picked by hand', async () => {
  renderOptions(<OptionsApp />);
  fireEvent.change(await screen.findByLabelText('Gradient start'), {
    target: { value: '#112233' },
  });

  expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
});

// --- backup

it('shows the imported settings after a backup replaced them', async () => {
  let stored = { ...DEFAULT_SETTINGS };
  const summary = { favorites: 0, pinnedTabs: 1, folders: 0, archivedTabs: 0 };
  renderOptions(<OptionsApp />, {
    answers: {
      'settings/get': () => stored,
      'backup/inspect': () => ({ ok: true, summary }),
      'backup/import': () => {
        stored = { ...stored, density: 'compact', autoArchiveHours: 72 };
        return { ok: true, summary };
      },
    },
  });
  const file = new File(['{}'], 'backup.json', { type: 'application/json' });
  await userEvent.upload(await screen.findByLabelText('Backup file'), file);

  await userEvent.click(await screen.findByRole('button', { name: 'Replace my data' }));

  await waitFor(() => expect(screen.getByRole('radio', { name: 'Compact' })).toBeChecked());
  expect(screen.getByRole('spinbutton', { name: 'Auto Archive delay in hours' })).toHaveValue(72);
});

it('uses the saved gradient and density for its own look', async () => {
  renderOptions(<OptionsApp />, {
    settings: { ...DEFAULT_SETTINGS, density: 'spacious', gradientFrom: '#000000' },
  });
  await screen.findByRole('radio', { name: 'Spacious' });
  expect(cssVariable('--row-height')).toBe('40px');
  expect(cssVariable('--panel-from-light')).toBe('#b3b3b3');

  await userEvent.click(screen.getByRole('radio', { name: 'Compact' }));
  expect(cssVariable('--row-height')).toBe('28px');
});
