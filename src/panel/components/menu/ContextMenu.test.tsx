import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ContextMenu, MenuItem, MenuSeparator, SubMenu } from './index';

function renderMenu(overrides: { onClose?: () => void; onDelete?: () => void } = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onRename = vi.fn();
  const onDelete = overrides.onDelete ?? vi.fn();
  render(
    <>
      <button type="button">Row</button>
      <ContextMenu label="Actions" x={10} y={10} onClose={onClose}>
        <MenuItem onSelect={onRename}>Rename</MenuItem>
        <MenuItem disabled onSelect={vi.fn()}>
          Reset
        </MenuItem>
        <MenuItem onSelect={vi.fn()}>Copy URL</MenuItem>
        <MenuSeparator />
        <MenuItem danger onSelect={onDelete}>
          Delete
        </MenuItem>
      </ContextMenu>
    </>,
  );
  return { onClose, onRename, onDelete };
}

const entry = (name: string) => screen.getByRole('menuitem', { name });

it('focuses the first entry when the menu opens', () => {
  renderMenu();

  expect(entry('Rename')).toHaveFocus();
});

it('makes the entry under the pointer the active one, so that pointer and keyboard agree', async () => {
  renderMenu();

  await userEvent.hover(entry('Copy URL'));
  expect(entry('Copy URL')).toHaveFocus();

  await userEvent.keyboard('{ArrowDown}');
  expect(entry('Delete')).toHaveFocus();
});

it('does not activate a disabled entry on hover or click', async () => {
  const { onClose } = renderMenu();

  await userEvent.hover(entry('Copy URL'));
  await userEvent.hover(entry('Reset'));
  expect(entry('Reset')).not.toHaveFocus();
  expect(entry('Copy URL')).not.toHaveFocus();
  await userEvent.click(entry('Reset'));

  expect(entry('Reset')).toHaveAttribute('aria-disabled', 'true');
  expect(onClose).not.toHaveBeenCalled();
});

it('closes the menu, then runs the action of the clicked entry', async () => {
  const calls: string[] = [];
  renderMenu({ onClose: () => calls.push('close'), onDelete: () => calls.push('delete') });

  await userEvent.click(entry('Delete'));

  expect(calls).toEqual(['close', 'delete']);
});

it('closes on a press outside, on Escape and on window blur', async () => {
  const { onClose } = renderMenu();

  await userEvent.click(screen.getByRole('button', { name: 'Row' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(2);
  fireEvent.blur(window);
  expect(onClose).toHaveBeenCalledTimes(3);
});

it('does not close on a press inside the menu', async () => {
  const { onClose } = renderMenu();

  await userEvent.pointer({ keys: '[MouseRight]', target: entry('Reset') });
  fireEvent.pointerDown(screen.getByRole('menu'));

  expect(onClose).not.toHaveBeenCalled();
});

/** A row whose right click opens the menu, like the rows of the panel. */
function RowWithMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onContextMenu={() => setOpen(true)}>
        Row
      </button>
      {open && (
        <ContextMenu label="Actions" x={0} y={0} onClose={() => setOpen(false)}>
          <MenuItem onSelect={vi.fn()}>Rename</MenuItem>
          <MenuItem onSelect={vi.fn()}>Delete</MenuItem>
        </ContextMenu>
      )}
    </>
  );
}

function renderWithRow() {
  render(<RowWithMenu />);
  const row = screen.getByRole('button', { name: 'Row' });
  row.focus();
  fireEvent.contextMenu(row);
  return { row };
}

it('moves the focus with the arrow keys, wraps around and skips disabled entries', async () => {
  renderMenu();

  await userEvent.keyboard('{ArrowDown}');
  expect(entry('Copy URL')).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}{ArrowDown}');
  expect(entry('Rename')).toHaveFocus();
  await userEvent.keyboard('{ArrowUp}');
  expect(entry('Delete')).toHaveFocus();
});

it('jumps to the first and the last entry with Home and End', async () => {
  renderMenu();

  await userEvent.keyboard('{End}');
  expect(entry('Delete')).toHaveFocus();
  await userEvent.keyboard('{Home}');
  expect(entry('Rename')).toHaveFocus();
});

it('runs the active entry on Enter and on Space', async () => {
  const { onRename, onDelete } = renderMenu();

  await userEvent.keyboard('{Enter}');
  expect(onRename).toHaveBeenCalledTimes(1);
  await userEvent.keyboard('{End}{ }');
  expect(onDelete).toHaveBeenCalledTimes(1);
});

it('starts from the first entry again after the pointer left the menu', async () => {
  renderMenu();

  await userEvent.hover(entry('Copy URL'));
  await userEvent.unhover(entry('Copy URL'));
  await userEvent.keyboard('{ArrowDown}');

  expect(entry('Copy URL')).not.toHaveFocus();
  expect(entry('Rename')).toHaveFocus();
});

it('closes on Escape and gives the focus back to the row', async () => {
  const { row } = renderWithRow();
  expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();

  await userEvent.keyboard('{Escape}');

  expect(screen.queryByRole('menu')).toBeNull();
  expect(row).toHaveFocus();
});

it('closes on Tab and gives the focus back to the row', async () => {
  const { row } = renderWithRow();

  await userEvent.keyboard('{Tab}');

  expect(screen.queryByRole('menu')).toBeNull();
  expect(row).toHaveFocus();
});

function renderWithSubmenu({ disabled = false }: { disabled?: boolean } = {}) {
  const onClose = vi.fn();
  const onHome = vi.fn();
  render(
    <ContextMenu label="Actions" x={10} y={10} onClose={onClose}>
      <MenuItem onSelect={vi.fn()}>Rename</MenuItem>
      <SubMenu label="Move to…" disabled={disabled}>
        <MenuItem onSelect={vi.fn()}>Favorites</MenuItem>
        <MenuItem onSelect={onHome}>Home</MenuItem>
      </SubMenu>
      <MenuItem onSelect={vi.fn()}>Copy URL</MenuItem>
    </ContextMenu>,
  );
  return { onClose, onHome };
}

const submenu = () => screen.queryByRole('menu', { name: 'Move to…' });

it('opens a submenu on click, beside its entry, with the first entry active', async () => {
  renderWithSubmenu();
  const trigger = entry('Move to…');
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await userEvent.click(trigger);

  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(submenu()).toBeVisible();
  expect(entry('Favorites')).toHaveFocus();
});

it('opens a submenu when the pointer rests on its entry, after a short delay', async () => {
  renderWithSubmenu();

  await userEvent.hover(entry('Move to…'));
  expect(submenu()).toBeNull();

  expect(await screen.findByRole('menu', { name: 'Move to…' })).toBeVisible();
  expect(entry('Move to…')).toHaveFocus();
});

it('does not open a submenu when the pointer only passes over its entry', async () => {
  renderWithSubmenu();

  await userEvent.hover(entry('Move to…'));
  await userEvent.hover(entry('Copy URL'));
  await new Promise((resolve) => setTimeout(resolve, 400));

  expect(submenu()).toBeNull();
});

it('closes the submenu when the pointer moves to another entry of the menu', async () => {
  renderWithSubmenu();
  await userEvent.click(entry('Move to…'));

  await userEvent.hover(entry('Copy URL'));

  expect(submenu()).toBeNull();
  expect(entry('Copy URL')).toHaveFocus();
});

it('opens the submenu with ArrowRight, and closes only the submenu with ArrowLeft', async () => {
  renderWithSubmenu();
  await userEvent.keyboard('{ArrowDown}');
  expect(entry('Move to…')).toHaveFocus();

  await userEvent.keyboard('{ArrowRight}');
  expect(entry('Favorites')).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}{ArrowDown}');
  expect(entry('Favorites')).toHaveFocus();
  await userEvent.keyboard('{ArrowLeft}');

  expect(submenu()).toBeNull();
  expect(screen.getByRole('menu', { name: 'Actions' })).toBeVisible();
  expect(entry('Move to…')).toHaveFocus();
});

it('closes the whole menu and runs the command when a submenu entry is chosen', async () => {
  const { onClose, onHome } = renderWithSubmenu();
  await userEvent.click(entry('Move to…'));

  await userEvent.click(entry('Home'));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onHome).toHaveBeenCalledTimes(1);
});

it('does not close the menu on a press inside the submenu, and closes everything on Escape', async () => {
  const { onClose } = renderWithSubmenu();
  await userEvent.click(entry('Move to…'));

  fireEvent.pointerDown(entry('Home'));
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}');

  expect(onClose).toHaveBeenCalledTimes(1);
});

it('does not open a disabled submenu', async () => {
  renderWithSubmenu({ disabled: true });

  await userEvent.click(entry('Move to…'));
  await userEvent.hover(entry('Move to…'));
  await new Promise((resolve) => setTimeout(resolve, 400));

  expect(entry('Move to…')).toHaveAttribute('aria-disabled', 'true');
  expect(submenu()).toBeNull();
});

/** A panel of 200 x 150 pixels. Each menu box is 100 x 80. The entry "Move to…" is 60 x 24. */
function stubLayout(entryBox: { left: number; top: number }) {
  vi.stubGlobal('innerWidth', 200);
  vi.stubGlobal('innerHeight', 150);
  const box = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
    }) as DOMRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.getAttribute('role') === 'menu') return box(0, 0, 100, 80);
    if (this.textContent?.startsWith('Move to…')) return box(entryBox.left, entryBox.top, 60, 24);
    return box(0, 0, 0, 0);
  });
}

afterEach(() => vi.unstubAllGlobals());

const position = (name: string) => {
  const { left, top } = screen.getByRole('menu', { name }).style;
  return { left, top };
};

it('keeps the menu inside the panel, and flips it to the left and above near the edges', () => {
  stubLayout({ left: 0, top: 0 });
  render(
    <ContextMenu label="Actions" x={190} y={140} onClose={vi.fn()}>
      <MenuItem onSelect={vi.fn()}>Rename</MenuItem>
    </ContextMenu>,
  );

  expect(position('Actions')).toEqual({ left: '90px', top: '60px' });
});

it('keeps a menu that is wider than the panel inside the panel', () => {
  stubLayout({ left: 0, top: 0 });
  vi.stubGlobal('innerWidth', 90);
  render(
    <ContextMenu label="Actions" x={50} y={10} onClose={vi.fn()}>
      <MenuItem onSelect={vi.fn()}>Rename</MenuItem>
    </ContextMenu>,
  );

  expect(position('Actions')).toEqual({ left: '6px', top: '10px' });
});

it('opens a submenu on the right of its entry, and on the left when there is no room', async () => {
  stubLayout({ left: 0, top: 20 });
  const { unmount } = render(
    <ContextMenu label="Actions" x={0} y={0} onClose={vi.fn()}>
      <SubMenu label="Move to…">
        <MenuItem onSelect={vi.fn()}>Home</MenuItem>
      </SubMenu>
    </ContextMenu>,
  );
  await userEvent.click(entry('Move to…'));
  // The submenu overlaps its entry by 4 pixels and lines up with it, 4 pixels higher.
  expect(position('Move to…')).toEqual({ left: '56px', top: '16px' });
  unmount();

  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  stubLayout({ left: 120, top: 20 });
  render(
    <ContextMenu label="Actions" x={0} y={0} onClose={vi.fn()}>
      <SubMenu label="Move to…">
        <MenuItem onSelect={vi.fn()}>Home</MenuItem>
      </SubMenu>
    </ContextMenu>,
  );
  await userEvent.click(entry('Move to…'));
  expect(position('Move to…')).toEqual({ left: '24px', top: '16px' });
});
