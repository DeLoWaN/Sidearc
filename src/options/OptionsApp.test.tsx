import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { OptionsApp } from './OptionsApp';

it('shows the options page title', () => {
  render(<OptionsApp />);
  expect(screen.getByRole('heading', { level: 1, name: 'Sidearc options' })).toBeVisible();
});
