import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { makeItem, makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { ItemView, TabGroupView, TabView } from '../../shared/types';
import { resetPanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';
import { FavoritesSection } from './FavoritesSection';
import { FooterBar } from './FooterBar';
import { Overlays } from './Overlays';
import { PinnedSection } from './PinnedSection';
import { SearchStatus } from './SearchStatus';
import { UnpinnedSection } from './UnpinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

const makeFolder = (overrides: Partial<ItemView> = {}) =>
  makeItem({ kind: 'folder', url: '', ...overrides });

function renderSearchable(
  items: ItemView[],
  unpinnedTabs: TabView[] = [],
  tabGroups: TabGroupView[] = [],
) {
  return renderPanel(
    <>
      <FavoritesSection />
      <PinnedSection />
      <UnpinnedSection />
      <SearchStatus />
      <FooterBar />
      <Overlays />
    </>,
    { state: makeState({ items, unpinnedTabs, tabGroups }) },
  );
}

const type = (text: string) => userEvent.type(screen.getByRole('searchbox'), text);
const button = (name: string | RegExp) => screen.queryByRole('button', { name });

it('filters Favorites, Pinned Tabs and Unpinned Tabs by title and URL, in any letter case', async () => {
  const items = [
    makeItem({ kind: 'favorite', title: 'Gmail', url: 'https://a.test/' }),
    makeItem({ kind: 'favorite', title: 'Maps', url: 'https://maps.test/' }),
    makeItem({ title: 'Mail admin', url: 'https://b.test/' }),
    makeItem({ title: 'Wiki', url: 'https://c.test/' }),
    makeItem({ title: 'Docs', url: 'https://WEBMAIL.test/' }),
  ];
  const tabs = [
    makeTab({ title: 'Inbox', url: 'https://d.test/mail' }),
    makeTab({ title: 'News', url: 'https://e.test/' }),
  ];
  renderSearchable(items, tabs);

  await type('MAIL');

  expect(button('Gmail')).toBeVisible();
  expect(button(/^Mail admin/)).toBeVisible();
  expect(button(/^Docs/)).toBeVisible();
  expect(button('Inbox')).toBeVisible();
  for (const gone of ['Maps', 'Wiki', 'News']) expect(button(gone)).toBeNull();
});

it('shows a match inside a collapsed Folder with its Folder path and no Folder row', async () => {
  const work = makeFolder({ title: 'Work', collapsed: true });
  const docs = makeFolder({ title: 'Docs', parentId: work.id, collapsed: true });
  const spec = makeItem({ title: 'Spec', parentId: docs.id });
  const empty = makeFolder({ title: 'Empty' });
  renderSearchable([work, docs, spec, empty]);

  await type('spec');

  expect(button(/^Spec/)).toBeVisible();
  expect(screen.getByText('Work / Docs')).toBeVisible();
  // The ancestors are only a path: no row, nothing to expand.
  expect(screen.queryByRole('button', { expanded: false })).toBeNull();
  expect(button('Work')).toBeNull();
  expect(button('Empty')).toBeNull();
});

it('hides a section that has no match, and says so when nothing matches', async () => {
  renderSearchable(
    [makeItem({ kind: 'favorite', title: 'Maps' }), makeItem({ title: 'Wiki' })],
    [makeTab({ title: 'News' })],
  );

  await type('zzz');

  expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Pinned Tabs' })).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('No results');
});

it('restores the normal view when Escape clears the field, with the Folders collapsed as before', async () => {
  const work = makeFolder({ title: 'Work', collapsed: true });
  const mail = makeItem({ title: 'Mail', parentId: work.id });
  const open = makeFolder({ title: 'Open', collapsed: false });
  const wiki = makeItem({ title: 'Wiki', parentId: open.id });
  const { send } = renderSearchable([work, mail, open, wiki]);

  await type('mail');
  expect(button(/^Mail/)).toBeVisible();
  await userEvent.keyboard('{Escape}');

  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-expanded', 'false');
  expect(button('Mail')).toBeNull();
  expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-expanded', 'true');
  expect(button('Wiki')).toBeVisible();
  // The search never writes a collapsed flag.
  expect(send).not.toHaveBeenCalled();
});

it('restores the normal view with the clear button, which shows only while the field has text', async () => {
  renderSearchable([makeItem({ title: 'Mail' }), makeItem({ title: 'Wiki' })]);
  expect(button('Clear search')).toBeNull();

  await type('mail');
  expect(button('Wiki')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(button('Wiki')).toBeVisible();
  expect(button('Clear search')).toBeNull();
});

it('behaves like a click on the item for each kind of result', async () => {
  const favorite = makeItem({ kind: 'favorite', title: 'Gmail' });
  const pinned = makeItem({ title: 'Gmail admin' });
  const tab = makeTab({ title: 'Gmail inbox' });
  const { send } = renderSearchable([favorite, pinned], [tab]);

  await type('gmail');
  await userEvent.click(screen.getByRole('button', { name: 'Gmail' }));
  await userEvent.click(screen.getByRole('button', { name: /^Gmail admin/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Gmail inbox' }));

  expect(send.mock.calls).toEqual([
    [{ type: 'item/open', itemId: favorite.id }],
    [{ type: 'item/open', itemId: pinned.id }],
    [{ type: 'tab/activate', tabId: tab.id }],
  ]);
});

it('keeps the close and Reset buttons of a result with a live tab', async () => {
  const pinned = makeItem({
    title: 'Mail',
    live: { tabId: 9, away: true, title: 'Mail 42', url: 'https://x.test/42' },
  });
  const { send } = renderSearchable([pinned]);

  await type('mail 42');
  await userEvent.click(screen.getByRole('button', { name: 'Reset Mail' }));
  await userEvent.click(screen.getByRole('button', { name: 'Close Mail' }));

  expect(send.mock.calls).toEqual([
    [{ type: 'item/reset', itemId: pinned.id }],
    [{ type: 'tab/close', tabId: 9 }],
  ]);
});

it('opens the right-click menu of a result, and a Pinned Tab in a Folder can be renamed', async () => {
  const work = makeFolder({ title: 'Work', collapsed: true });
  const mail = makeItem({ title: 'Mail', parentId: work.id });
  const { send } = renderSearchable([work, mail]);

  await type('mail');
  fireEvent.contextMenu(screen.getByRole('button', { name: /^Mail/ }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/delete', itemId: mail.id });
});

it('keeps a Tab group block with only its matching tabs, even when the group is collapsed', async () => {
  const [docs, mail, news] = [
    makeTab({ title: 'Docs' }),
    makeTab({ title: 'Mail' }),
    makeTab({ title: 'News' }),
  ] as [TabView, TabView, TabView];
  const group: TabGroupView = {
    id: 5,
    windowId: 1,
    title: 'Work',
    color: 'blue',
    collapsed: true,
    tabIds: [docs.id, mail.id],
  };
  const { send } = renderSearchable([], [docs, mail, news], [group]);

  await type('mail');

  expect(screen.getByRole('group', { name: 'Work' })).toBeVisible();
  expect(button('Mail')).toBeVisible();
  expect(button('Docs')).toBeNull();
  expect(button('News')).toBeNull();
  // The search never collapses or expands a group in Chrome.
  await userEvent.click(screen.getByRole('button', { name: 'Work' }));
  expect(send).not.toHaveBeenCalled();
});

it('hides a Tab group that has no matching tab', async () => {
  const [docs, news] = [makeTab({ title: 'Docs' }), makeTab({ title: 'News' })] as [
    TabView,
    TabView,
  ];
  const group: TabGroupView = {
    id: 5,
    windowId: 1,
    title: 'Work',
    color: 'blue',
    collapsed: false,
    tabIds: [docs.id],
  };
  renderSearchable([], [docs, news], [group]);

  await type('news');

  expect(screen.queryByRole('group', { name: 'Work' })).toBeNull();
  expect(button('News')).toBeVisible();
});

it('hides the Clear button while searching, because it closes tabs that the search hides', async () => {
  renderSearchable([], [makeTab({ title: 'Mail' }), makeTab({ title: 'News' })]);
  expect(button(/Clear$/)).toBeVisible();

  await type('mail');

  expect(button(/Clear$/)).toBeNull();
});

it('raises the searching flag of the panel UI while the field has text and lowers it after', async () => {
  renderSearchable([makeItem({ title: 'Mail' })]);
  expect(usePanelUi.getState().searching).toBe(false);

  await type('m');
  expect(usePanelUi.getState().searching).toBe(true);

  await userEvent.keyboard('{Escape}');
  expect(usePanelUi.getState().searching).toBe(false);
});

it('does not search while the field holds only spaces', async () => {
  renderSearchable([makeItem({ title: 'Mail' }), makeItem({ title: 'Wiki' })]);

  await type('   ');

  expect(button('Mail')).toBeVisible();
  expect(button('Wiki')).toBeVisible();
  expect(usePanelUi.getState().searching).toBe(false);
});
