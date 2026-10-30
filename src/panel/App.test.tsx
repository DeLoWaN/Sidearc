import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from './App';

it('shows an empty Sidearc page', () => {
  render(<App />);
  expect(screen.getByRole('main', { name: 'Sidearc' })).toBeEmptyDOMElement();
});
