import { act, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { makeItem, makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import { FavoritesSection } from '../sections/FavoritesSection';
import { PinnedSection } from '../sections/PinnedSection';
import { UnpinnedSection } from '../sections/UnpinnedSection';
import { resetPanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';
import { resetPanelDrag, usePanelDrag } from './drag-store';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
  resetPanelDrag();
});

function renderAll(
  items = [makeItem({ title: 'Mail' }), makeItem({ title: 'Docs', kind: 'favorite' })],
  tabTitle = 'News',
) {
  return renderPanel(
    <>
      <FavoritesSection />
      <PinnedSection />
      <UnpinnedSection />
    </>,
    { state: makeState({ items, unpinnedTabs: [makeTab({ title: tabTitle })] }) },
  );
}

const draggableOf = (name: string) =>
  screen.getByRole('button', { name }).closest('li')?.getAttribute('draggable');

it('makes a Favorite, a Pinned Tab and an Unpinned Tab draggable', () => {
  renderAll();

  expect(draggableOf('Docs')).toBe('true');
  expect(draggableOf('Mail')).toBe('true');
  expect(draggableOf('News')).toBe('true');
});

it('makes the Folder row draggable, not its content', () => {
  const work = makeItem({ kind: 'folder', url: '', title: 'Work' });
  renderAll([work]);

  const header = screen.getByRole('button', { name: 'Work' }).parentElement;
  expect(header?.getAttribute('draggable')).toBe('true');
});

it('drags and drops nothing while a search shows its results', () => {
  renderAll(
    [makeItem({ title: 'Mail box' }), makeItem({ title: 'Docs box', kind: 'favorite' })],
    'News box',
  );

  act(() => usePanelUi.getState().setSearchQuery('box'));

  for (const name of ['Docs box', 'Mail box', 'News box']) {
    const row = screen.getByRole('button', { name }).closest('li');
    expect(row?.getAttribute('draggable')).not.toBe('true');
    expect(row?.hasAttribute('data-drop-target-for-element')).toBe(false);
  }
  expect(screen.getByRole('region', { name: 'Pinned Tabs' })).not.toHaveAttribute(
    'data-drop-target-for-element',
  );
});

it('shows a place for the first Favorite only while the user drags, when there is no Favorite', () => {
  renderAll([makeItem({ title: 'Mail' })]);
  expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();

  act(() => usePanelDrag.setState({ source: { type: 'tab', tabId: 1 } }));

  expect(screen.getByRole('region', { name: 'Favorites' })).toHaveTextContent(
    'Drop here to add a Favorite',
  );
});

it('shows no place for a Favorite during a search', () => {
  renderAll([makeItem({ title: 'Mail' })]);
  act(() => usePanelUi.getState().setSearchQuery('mail'));

  act(() => usePanelDrag.setState({ source: { type: 'tab', tabId: 1 } }));

  expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
});
