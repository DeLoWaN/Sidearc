import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { makeItem, makeState } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { ItemView } from '../../shared/types';
import { resetPanelStore, usePanelStore } from '../store';
import { resetPanelUi } from '../ui-store';
import { Overlays } from './Overlays';
import { PinnedSection } from './PinnedSection';
import { UnpinnedSection } from './UnpinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

const makeFolder = (overrides: Partial<ItemView> = {}) =>
  makeItem({ kind: 'folder', url: '', ...overrides });

function renderPinned(items: ItemView[], windowId = 1) {
  return renderPanel(
    <>
      <PinnedSection />
      <UnpinnedSection />
      <Overlays />
    </>,
    { state: makeState({ items }), windowId },
  );
}

const rightClick = (name: string | RegExp) =>
  fireEvent.contextMenu(screen.getByRole('button', { name }));

it('shows Folders and Pinned Tabs as a tree, ordered by position inside each parent', () => {
  const work = makeFolder({ title: 'Work', position: 0 });
  const projects = makeFolder({ title: 'Projects', parentId: work.id, position: 1 });
  const mail = makeItem({ title: 'Mail', parentId: work.id, position: 0 });
  const deep = makeItem({ title: 'Deep', parentId: projects.id });
  const wiki = makeItem({ title: 'Wiki', position: 1 });
  renderPinned([wiki, deep, projects, mail, work]);

  const tree = within(screen.getByRole('list', { name: 'Pinned Tabs list' }));
  const labels = (scope: ReturnType<typeof within>) =>
    scope.getAllByRole('button').map((button: HTMLElement) => button.textContent);
  expect(labels(tree)).toEqual(['Work', 'Mail', 'Projects', 'Deep', 'Wiki']);
  // Each level sits inside the list of its Folder.
  const inWork = within(screen.getByRole('list', { name: 'Work content' }));
  expect(labels(inWork)).toEqual(['Mail', 'Projects', 'Deep']);
  expect(labels(within(screen.getByRole('list', { name: 'Projects content' })))).toEqual(['Deep']);
});

it('hides the content of a collapsed Folder and shows it when the state says expanded', () => {
  const work = makeFolder({ title: 'Work', collapsed: true });
  const mail = makeItem({ title: 'Mail', parentId: work.id });
  renderPinned([work, mail]);

  const header = screen.getByRole('button', { name: 'Work' });
  expect(header).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: 'Mail' })).toBeNull();
});

it('shows the content of an open Folder', () => {
  const work = makeFolder({ title: 'Work', collapsed: false });
  const mail = makeItem({ title: 'Mail', parentId: work.id });
  renderPinned([work, mail]);

  expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Mail' })).toBeVisible();
});

it('asks the worker to toggle a Folder when the user clicks it', async () => {
  const work = makeFolder({ title: 'Work' });
  const { send } = renderPinned([work]);

  await userEvent.click(screen.getByRole('button', { name: 'Work' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'folder/toggle', itemId: work.id });
});

it('creates a Folder at the root from the New folder button', async () => {
  const { send } = renderPinned([]);

  await userEvent.click(screen.getByRole('button', { name: 'New folder' }));
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Name of the new folder' }),
    'Work{Enter}',
  );

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'folder/create',
    title: 'Work',
    parentId: null,
  });
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('creates nothing when the user cancels the name or leaves it blank', async () => {
  const { send } = renderPinned([]);

  await userEvent.click(screen.getByRole('button', { name: 'New folder' }));
  await userEvent.type(screen.getByRole('textbox'), 'Work{Escape}');
  expect(screen.queryByRole('textbox')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'New folder' }));
  await userEvent.type(screen.getByRole('textbox'), '   {Enter}');
  expect(screen.queryByRole('textbox')).toBeNull();

  expect(send).not.toHaveBeenCalled();
});

it('creates a Folder at the root from a right click on the Pinned Tabs section', async () => {
  const { send } = renderPinned([makeItem({ title: 'Mail' })]);

  fireEvent.contextMenu(screen.getByRole('region', { name: 'Pinned Tabs' }));
  const menu = screen.getByRole('menu');
  expect(within(menu).getAllByRole('menuitem')).toHaveLength(1);
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'New folder' }));
  await userEvent.type(screen.getByRole('textbox'), 'Work{Enter}');

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'folder/create',
    title: 'Work',
    parentId: null,
  });
});

it('creates a Folder inside a Folder from the menu of that Folder', async () => {
  const work = makeFolder({ title: 'Work' });
  const { send } = renderPinned([work]);

  rightClick('Work');
  await userEvent.click(screen.getByRole('menuitem', { name: 'New folder' }));
  const field = within(screen.getByRole('list', { name: 'Work content' })).getByRole('textbox');
  await userEvent.type(field, 'Projects{Enter}');

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'folder/create',
    title: 'Projects',
    parentId: work.id,
  });
});

it('opens a collapsed Folder before it asks for the name of a new Folder inside it', async () => {
  const work = makeFolder({ title: 'Work', collapsed: true });
  const { send } = renderPinned([work]);

  rightClick('Work');
  await userEvent.click(screen.getByRole('menuitem', { name: 'New folder' }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'folder/toggle', itemId: work.id });

  // The worker answers with the Folder open.
  act(() =>
    usePanelStore.getState().receive(makeState({ items: [{ ...work, collapsed: false }] })),
  );
  const field = within(screen.getByRole('list', { name: 'Work content' })).getByRole('textbox');
  await userEvent.type(field, 'Projects{Enter}');

  expect(send).toHaveBeenLastCalledWith({
    type: 'folder/create',
    title: 'Projects',
    parentId: work.id,
  });
});

it('offers New folder, rename and delete in the right-click menu of a Folder', () => {
  renderPinned([makeFolder({ title: 'Work' })]);

  rightClick('Work');

  expect(
    within(screen.getByRole('menu'))
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent),
  ).toEqual(['New folder', 'Rename', 'Delete']);
});

it('renames a Folder in place from its menu', async () => {
  const work = makeFolder({ title: 'Work' });
  const { send } = renderPinned([work]);

  rightClick('Work');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
  const field = screen.getByRole('textbox', { name: 'Name of Work' });
  expect(field).toHaveValue('Work');
  await userEvent.clear(field);
  await userEvent.type(field, 'Job{Enter}');

  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'item/rename',
    itemId: work.id,
    title: 'Job',
  });
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('deletes an empty Folder at once', async () => {
  const work = makeFolder({ title: 'Work' });
  const { send } = renderPinned([work]);

  rightClick('Work');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/delete', itemId: work.id });
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('asks for confirmation before it deletes a Folder that is not empty', async () => {
  const work = makeFolder({ title: 'Work' });
  const projects = makeFolder({ title: 'Projects', parentId: work.id });
  const mail = makeItem({ title: 'Mail', parentId: projects.id });
  const { send } = renderPinned([work, projects, mail]);

  rightClick('Work');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

  expect(send).not.toHaveBeenCalled();
  const dialog = screen.getByRole('alertdialog', { name: 'Delete Work?' });
  expect(dialog).toHaveTextContent('2 items');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'item/delete', itemId: work.id });
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('keeps a Folder that is not empty when the user cancels the confirmation', async () => {
  const work = makeFolder({ title: 'Work' });
  const mail = makeItem({ title: 'Mail', parentId: work.id });
  const { send } = renderPinned([work, mail]);

  rightClick('Work');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('1 item');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('closes the confirmation on Escape', async () => {
  const work = makeFolder({ title: 'Work' });
  const { send } = renderPinned([work, makeItem({ parentId: work.id })]);

  rightClick('Work');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  await userEvent.keyboard('{Escape}');

  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

it('shows an empty Pinned Tabs section with a way to create a Folder', () => {
  renderPinned([]);

  expect(screen.getByRole('region', { name: 'Pinned Tabs' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'New folder' })).toBeVisible();
});
