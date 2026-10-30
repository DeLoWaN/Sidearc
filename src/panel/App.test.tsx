import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeItem, makeState, makeTab } from '../../tests/support/builders';
import { renderPanel } from '../../tests/support/render-panel';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { App } from './App';
import { resetPanelStore, usePanelStore } from './store';
import { resetPanelUi, usePanelUi } from './ui-store';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

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

describe('Ctrl+Z and Cmd+Z', () => {
  const withUndo = makeState({ undo: { label: 'Delete "Mail"' } });

  it('sends undo when the focus is on the page', () => {
    const { send } = renderPanel(<App />, { state: withUndo });

    expect(fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })).toBe(false);
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });

    expect(send.mock.calls).toEqual([[{ type: 'undo' }], [{ type: 'undo' }]]);
  });

  it('leaves the key to the search field, so the field can undo its own typing', () => {
    const { send } = renderPanel(<App />, { state: withUndo });
    const field = screen.getByRole('searchbox', { name: 'Search' });
    field.focus();

    expect(fireEvent.keyDown(field, { key: 'z', ctrlKey: true })).toBe(true);

    expect(send).not.toHaveBeenCalled();
  });

  it('leaves the key to the rename field', () => {
    const item = makeItem({ title: 'Mail' });
    const { send } = renderPanel(<App />, {
      state: makeState({ items: [item], undo: { label: 'Move "Mail"' } }),
    });
    act(() => usePanelUi.getState().startRename(item.id));
    const field = screen.getByRole('textbox', { name: 'Name of Mail' });

    expect(fireEvent.keyDown(field, { key: 'z', ctrlKey: true })).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('does nothing when nothing can be undone, and ignores Shift and a plain Z', () => {
    const { send } = renderPanel(<App />);
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(send).not.toHaveBeenCalled();

    act(() => usePanelStore.getState().receive(withUndo));
    fireEvent.keyDown(document.body, { key: 'z' });
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(send).not.toHaveBeenCalled();
  });
});
