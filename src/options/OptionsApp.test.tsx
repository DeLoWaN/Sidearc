import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { renderOptions } from '../../tests/support/render-options';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { OptionsApp } from './OptionsApp';

const cssVariable = (name: string) => document.documentElement.style.getPropertyValue(name);

it('shows the options page title', async () => {
  renderOptions(<OptionsApp />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Sidearc options' })).toBeVisible();
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
