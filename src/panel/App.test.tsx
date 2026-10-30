import { act, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { makeState, makeTab } from '../../tests/support/builders';
import { renderPanel } from '../../tests/support/render-panel';
import { App } from './App';
import { resetPanelStore, usePanelStore } from './store';

beforeEach(resetPanelStore);

it('shows the tabs of the state in the Sidearc page', () => {
  const state = makeState({ unpinnedTabs: [makeTab({ title: 'Mail' })] });
  renderPanel(<App />, { state });

  const page = screen.getByRole('main', { name: 'Sidearc' });
  expect(page).toHaveTextContent('Mail');
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
