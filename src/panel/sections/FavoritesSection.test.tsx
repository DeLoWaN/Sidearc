import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeItem, makeState } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { ItemView } from '../../shared/types';
import { resetPanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';
import { FavoritesSection } from './FavoritesSection';
import { Overlays } from './Overlays';
import { PinnedSection } from './PinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

afterEach(() => vi.useRealTimers());

const makeFavorite = (overrides: Parameters<typeof makeItem>[0] = {}) =>
  makeItem({ kind: 'favorite', ...overrides });

function renderFavorites(items: ItemView[], windowId = 1) {
  return renderPanel(
    <>
      <FavoritesSection />
      <PinnedSection />
      <Overlays />
    </>,
    { state: makeState({ items }), windowId },
  );
}

const favoriteList = () => within(screen.getByRole('list', { name: 'Favorites list' }));
const rightClick = (title: string) =>
  fireEvent.contextMenu(favoriteList().getByRole('button', { name: new RegExp(`^${title}`) }));

it('shows nothing when there is no Favorite', () => {
  renderFavorites([makeItem({ title: 'Mail' })]);

  expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
});

it('shows the Favorites as icons in the order of their position, and no Pinned Tab among them', () => {
  renderFavorites([
    makeItem({ title: 'Mail' }),
    makeFavorite({ title: 'Wiki', position: 1, iconUrl: 'https://wiki.test/icon.png' }),
    makeFavorite({ title: 'Docs', position: 0, iconUrl: 'https://docs.test/icon.png' }),
  ]);

  const tiles = favoriteList().getAllByRole('listitem');
  expect(tiles.map((tile) => tile.querySelector('button')?.getAttribute('aria-label'))).toEqual([
    'Docs',
    'Wiki',
  ]);
  expect(tiles[0]?.querySelector('img')).toHaveAttribute('src', 'https://docs.test/icon.png');
  // The title is the tooltip, and the grid shows no text.
  expect(tiles[0]?.querySelector('button')).toHaveAttribute('title', 'Docs');
  expect(tiles[0]?.textContent).toBe('');
  // The Pinned Tab stays in its own section.
  expect(within(screen.getByRole('list', { name: 'Pinned Tabs list' })).getByText('Mail'));
});

it('puts the Favorites above the Pinned Tabs', () => {
  renderFavorites([makeItem({ title: 'Mail' }), makeFavorite({ title: 'Docs' })]);

  const favorites = screen.getByRole('region', { name: 'Favorites' });
  const pinned = screen.getByRole('region', { name: 'Pinned Tabs' });
  expect(favorites.compareDocumentPosition(pinned)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

it('marks a Favorite whose live tab is open, and only that one', () => {
  renderFavorites([
    makeFavorite({ title: 'Docs', position: 0 }),
    makeFavorite({ title: 'Wiki', position: 1, live: { tabId: 7 } }),
  ]);

  const [rest, live] = favoriteList().getAllByRole('listitem') as [HTMLElement, HTMLElement];
  expect(rest).not.toHaveAttribute('data-live');
  expect(live).toHaveAttribute('data-live');
  expect(within(live).getByRole('img', { name: 'Open' })).toBeVisible();
  expect(within(rest).queryByRole('img', { name: 'Open' })).toBeNull();
});

it('highlights the Favorite that is on screen in this window only', () => {
  const state = [
    makeFavorite({ title: 'Docs', position: 0, live: { tabId: 7, windowId: 1, active: true } }),
    makeFavorite({ title: 'Wiki', position: 1, live: { tabId: 8, windowId: 2, active: true } }),
  ];
  renderFavorites(state, 1);

  const [docs, wiki] = favoriteList().getAllByRole('listitem') as [HTMLElement, HTMLElement];
  expect(docs).toHaveAttribute('data-highlighted');
  expect(wiki).not.toHaveAttribute('data-highlighted');
});

it('asks the worker to open the Favorite when the user clicks it', async () => {
  const item = makeFavorite({ title: 'Docs' });
  const { send } = renderFavorites([item]);

  await userEvent.click(favoriteList().getByRole('button', { name: 'Docs' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/open', itemId: item.id });
});

it('closes the live tab of a Favorite from a close button, and shows none at rest', async () => {
  const live = makeFavorite({ title: 'Docs', position: 0, live: { tabId: 7 } });
  const rest = makeFavorite({ title: 'Wiki', position: 1 });
  const { send } = renderFavorites([live, rest]);
  expect(screen.queryByRole('button', { name: 'Close Wiki' })).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Close Docs' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'tab/close', tabId: 7 });
});

it('offers rename, Reset, copy URL, Move to… and delete in a right-click menu', () => {
  renderFavorites([makeFavorite({ title: 'Docs', live: { tabId: 7 } })]);

  rightClick('Docs');

  expect(
    within(screen.getByRole('menu'))
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent),
  ).toEqual(['Rename', 'Reset', 'Copy URL', 'Move to…', 'Delete']);
});

it('disables Reset in the menu of a Favorite at rest', () => {
  renderFavorites([makeFavorite({ title: 'Docs' })]);

  rightClick('Docs');

  expect(screen.getByRole('menuitem', { name: 'Reset' })).toBeDisabled();
});

it('resets the Favorite from the right-click menu', async () => {
  const item = makeFavorite({ title: 'Docs', live: { tabId: 7 } });
  const { send } = renderFavorites([item]);

  rightClick('Docs');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Reset' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/reset', itemId: item.id });
});

it('copies the saved URL of a Favorite', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  renderFavorites([makeFavorite({ title: 'Docs', url: 'https://docs.test/home' })]);

  rightClick('Docs');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Copy URL' }));

  expect(writeText).toHaveBeenCalledExactlyOnceWith('https://docs.test/home');
  vi.unstubAllGlobals();
});

it('deletes a Favorite from the right-click menu without a confirmation', async () => {
  const item = makeFavorite({ title: 'Docs' });
  const { send } = renderFavorites([item]);

  rightClick('Docs');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/delete', itemId: item.id });
});

it('renames a Favorite in a field that replaces its icon', async () => {
  const item = makeFavorite({ title: 'Docs' });
  const { send } = renderFavorites([item]);

  rightClick('Docs');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
  const field = screen.getByRole('textbox', { name: 'Name of Docs' });
  await userEvent.clear(field);
  await userEvent.type(field, 'Documents{Enter}');

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'item/rename',
    itemId: item.id,
    title: 'Documents',
  });
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('moves a Favorite to the Pinned Tabs from "Move to…", and offers the Unpinned Tabs', async () => {
  const item = makeFavorite({ title: 'Docs' });
  const { send } = renderFavorites([item, makeItem({ kind: 'folder', url: '', title: 'Work' })]);

  rightClick('Docs');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Move to…' }));
  const targets = within(screen.getByRole('menu', { name: 'Move to…' })).getAllByRole('menuitem');
  expect(targets.map((entry) => entry.textContent)).toEqual([
    'Pinned Tabs',
    'Work',
    'Unpinned Tabs',
  ]);
  await userEvent.click(targets[0] as HTMLElement);

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'item/move',
    itemId: item.id,
    parentId: null,
  });
});

it('moves a Pinned Tab to the Favorites from "Move to…"', async () => {
  const item = makeItem({ title: 'Mail' });
  const { send } = renderFavorites([item]);

  fireEvent.contextMenu(screen.getByRole('button', { name: 'Mail' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Move to…' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Favorites' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/favorite', itemId: item.id });
});

it('offers the Favorites to a Pinned Tab inside a Folder, before the root and the Folders, and the Unpinned Tabs last', async () => {
  const work = makeItem({ kind: 'folder', url: '', title: 'Work' });
  renderFavorites([work, makeItem({ title: 'Mail', parentId: work.id })]);

  fireEvent.contextMenu(screen.getByRole('button', { name: 'Mail' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Move to…' }));

  expect(
    within(screen.getByRole('menu', { name: 'Move to…' }))
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent),
  ).toEqual(['Favorites', 'Pinned Tabs', 'Unpinned Tabs']);
});

it('does not offer the Favorites to a Folder', () => {
  renderFavorites([makeItem({ kind: 'folder', url: '', title: 'Work' })]);

  fireEvent.contextMenu(screen.getByRole('button', { name: 'Work' }));

  expect(screen.getByRole('menuitem', { name: 'Move to…' })).toBeDisabled();
});

it('shows the notice that the worker sends, and hides it with the close button', async () => {
  renderFavorites([]);
  expect(screen.queryByRole('status')).toBeNull();

  act(() => usePanelUi.getState().showNotice('Sidearc keeps 12 Favorites at most.'));

  expect(screen.getByRole('status')).toHaveTextContent('Sidearc keeps 12 Favorites at most.');
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByRole('status')).toBeNull();
});

it('hides the notice by itself after a few seconds', () => {
  vi.useFakeTimers();
  renderFavorites([]);

  act(() => usePanelUi.getState().showNotice('Sidearc keeps 12 Favorites at most.'));
  expect(screen.getByRole('status')).toBeVisible();
  act(() => vi.advanceTimersByTime(5000));

  expect(screen.queryByRole('status')).toBeNull();
});
