import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { makeItem, makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import { resetPanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';
import { PinnedSection } from './PinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

it('invites the user to import from Arc or to pin a tab while Sidesweep is empty', () => {
  renderPanel(<PinnedSection />);

  const card = screen.getByRole('region', { name: 'Getting started' });
  expect(card).toHaveTextContent('Your Pinned Tabs will show here.');
  expect(card).toHaveTextContent('Or press Alt+Shift+P to pin the current tab.');
  expect(screen.getByRole('button', { name: 'Import from Arc' })).toBeVisible();
});

it('asks the worker to open the options page from the Import from Arc button', async () => {
  const { send } = renderPanel(<PinnedSection />);

  await userEvent.click(screen.getByRole('button', { name: 'Import from Arc' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'options/open' });
});

it.each([
  ['Pinned Tab', makeItem({ title: 'Mail' })],
  ['Favorite', makeItem({ title: 'Mail', kind: 'favorite' })],
  ['Folder', makeItem({ title: 'Work', kind: 'folder', url: '' })],
])('does not show the card when Sidesweep holds a %s', (_kind, item) => {
  renderPanel(<PinnedSection />, { state: makeState({ items: [item] }) });

  expect(screen.queryByRole('region', { name: 'Getting started' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Import from Arc' })).not.toBeInTheDocument();
});

it('shows the card while the only tabs are Unpinned Tabs', () => {
  renderPanel(<PinnedSection />, { state: makeState({ unpinnedTabs: [makeTab()] }) });

  expect(screen.getByRole('region', { name: 'Getting started' })).toBeVisible();
});

it('hides the card while the user searches', () => {
  usePanelUi.setState({ searchQuery: 'mail' });
  renderPanel(<PinnedSection />);

  expect(screen.queryByRole('region', { name: 'Getting started' })).not.toBeInTheDocument();
});
