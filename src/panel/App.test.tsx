import { act, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { makeState, makeTab } from '../../tests/support/builders';
import { renderPanel } from '../../tests/support/render-panel';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { App } from './App';
import { resetPanelStore, usePanelStore } from './store';

beforeEach(resetPanelStore);

it('shows the tabs of the state in the Sidearc page', () => {
  const state = makeState({ unpinnedTabs: [makeTab({ title: 'Mail' })] });
  renderPanel(<App />, { state });

  const page = screen.getByRole('main', { name: 'Sidearc' });
  expect(page).toHaveTextContent('Mail');
});

const cssVariable = (name: string) => document.documentElement.style.getPropertyValue(name);

it('sizes the rows and the Favorite tiles with the density of the settings', () => {
  const state = makeState({ settings: { ...DEFAULT_SETTINGS, density: 'spacious' } });
  renderPanel(<App />, { state });

  expect(cssVariable('--row-height')).toBe('40px');
  expect(cssVariable('--favorite-size')).toBe('56px');
});

it('paints the panel with the gradient of the settings, for light and dark mode', () => {
  const settings = { ...DEFAULT_SETTINGS, gradientFrom: '#000000', gradientTo: '#ffffff' };
  renderPanel(<App />, { state: makeState({ settings }) });

  expect(cssVariable('--panel-from-light')).toBe('#b3b3b3');
  expect(cssVariable('--panel-to-dark')).toBe('#595959');
});

it('changes the look at once when the worker sends other settings', () => {
  renderPanel(<App />);
  expect(cssVariable('--row-height')).toBe('32px');

  act(() =>
    usePanelStore
      .getState()
      .receive(makeState({ settings: { ...DEFAULT_SETTINGS, density: 'compact' } })),
  );

  expect(cssVariable('--row-height')).toBe('28px');
});

it('shows every new state that the worker sends', () => {
  renderPanel(<App />);
  expect(screen.queryAllByRole('listitem')).toHaveLength(0);

  act(() =>
    usePanelStore
      .getState()
      .receive(
        makeState({ unpinnedTabs: [makeTab({ title: 'Mail' }), makeTab({ title: 'Wiki' })] }),
      ),
  );
  expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['Mail', 'Wiki']);

  act(() =>
    usePanelStore.getState().receive(makeState({ unpinnedTabs: [makeTab({ title: 'Wiki' })] })),
  );
  expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['Wiki']);
});
