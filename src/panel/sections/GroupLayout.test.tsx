import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { TabView } from '../../shared/types';
import { resetPanelStore } from '../store';
import { resetPanelUi, usePanelUi } from '../ui-store';
import { UnpinnedSection } from './UnpinnedSection';

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
});

/** The two kinds of group share one layout: every test below runs for both. */
const kinds = [
  { kind: 'Site group', name: 'docs.test' },
  { kind: 'Tab group', name: 'Work' },
] as const;

function renderGroup(
  kind: (typeof kinds)[number]['kind'],
  { collapsed = false, unvisited = false } = {},
) {
  const tabs = [
    makeTab({ title: 'Home', iconUrl: 'https://docs.test/icon.png' }),
    makeTab({ title: 'Guide', unvisited }),
  ] as [TabView, TabView];
  const tabIds = tabs.map((tab) => tab.id);
  const state =
    kind === 'Site group'
      ? makeState({
          unpinnedTabs: tabs,
          siteGroups: [{ id: 'site-1', host: 'docs.test', name: null, tabIds, collapsed }],
        })
      : makeState({
          unpinnedTabs: tabs,
          tabGroups: [{ id: 5, windowId: 1, title: 'Work', color: 'green', collapsed, tabIds }],
        });
  return renderPanel(<UnpinnedSection />, { state });
}

describe.each(kinds)('$kind', ({ kind, name }) => {
  const block = () => screen.getByRole('group', { name });
  const header = () => screen.getByRole('button', { name });
  /** The row of the header: the header button and the close button. */
  const headerRow = () => header().parentElement as HTMLElement;

  it('puts the header first in the block, with the members in an indented list after it', () => {
    renderGroup(kind);

    expect(block().firstElementChild).toBe(headerRow());
    const members = headerRow().nextElementSibling as HTMLElement;
    expect(members.tagName).toBe('UL');
    expect(
      within(members)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['Home', 'Guide']);
    // One indent step of 24px, and no guide line.
    expect(members).toHaveClass('ml-6');
    expect(block().className).not.toMatch(/\bborder/);
    expect(members.className).not.toMatch(/\bborder/);
  });

  it('gives the header the height and the shape of a tab row', () => {
    renderGroup(kind);

    expect(headerRow()).toHaveClass('h-(--row-height)', 'rounded-[10px]');
    expect(header()).toHaveClass('px-2.5', 'font-semibold');
    expect(within(header()).getByText(name)).toBeVisible();
  });

  it('puts the close button at the right end of the header row, hidden until a hover or a focus', () => {
    renderGroup(kind);

    const close = screen.getByRole('button', { name: `Close group ${name}` });
    expect(headerRow().lastElementChild).toBe(close);
    expect(close).toHaveClass('opacity-0', 'group-hover/block:opacity-100');
    expect(close).toHaveClass(
      'focus-visible:opacity-100',
      'group-has-[:focus-visible]/block:opacity-100',
    );
  });

  it('shows the chevron after the name, pointing down when open and right when collapsed', () => {
    renderGroup(kind);

    const nameElement = within(header()).getByText(name);
    const chevron = header().querySelector('[data-chevron]') as Element;
    expect(nameElement.compareDocumentPosition(chevron)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(chevron).toHaveAttribute('data-chevron', 'down');
    expect(header()).toHaveAttribute('aria-expanded', 'true');
    cleanup();

    renderGroup(kind, { collapsed: true });
    expect(header().querySelector('[data-chevron]')).toHaveAttribute('data-chevron', 'right');
    expect(header()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the member count only while the group is collapsed', () => {
    renderGroup(kind);
    expect(header()).not.toHaveTextContent('2');
    cleanup();

    renderGroup(kind, { collapsed: true });
    expect(header()).toHaveTextContent('2');
    expect(screen.queryByRole('button', { name: 'Home' })).toBeNull();
  });

  it('shows the unvisited dot on a collapsed header when a hidden member is unvisited', () => {
    renderGroup(kind, { collapsed: true, unvisited: true });

    expect(within(header()).getByRole('img', { name: 'Not visited yet' })).toBeVisible();
  });

  it('shows no unvisited dot on a collapsed header when every member was visited', () => {
    renderGroup(kind, { collapsed: true });

    expect(within(header()).queryByRole('img', { name: 'Not visited yet' })).toBeNull();
  });

  it('shows no unvisited dot on an expanded header, and the member row keeps its own', () => {
    renderGroup(kind, { unvisited: true });

    expect(within(header()).queryByRole('img', { name: 'Not visited yet' })).toBeNull();
    expect(screen.getAllByRole('img', { name: 'Not visited yet' })).toHaveLength(1);
  });

  it('expands a collapsed group and turns the header off while a search runs', () => {
    renderGroup(kind, { collapsed: true });
    act(() => usePanelUi.getState().setSearchQuery('guide'));

    expect(header()).toHaveAttribute('aria-expanded', 'true');
    expect(header()).toBeDisabled();
    expect(
      within(block())
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['Guide']);
  });

  it('toggles from a click on the header', async () => {
    const { send } = renderGroup(kind);

    await userEvent.click(header());

    expect(send).toHaveBeenCalledExactlyOnceWith(
      kind === 'Site group'
        ? { type: 'site-group/toggle', groupId: 'site-1' }
        : { type: 'group/toggle', groupId: 5 },
    );
  });
});

it('leads a Site group header with the site icon', () => {
  renderGroup('Site group');

  const header = screen.getByRole('button', { name: 'docs.test' });
  expect(header.querySelector('img')).toHaveAttribute('src', 'https://docs.test/icon.png');
  expect(header.querySelector('[data-group-dot]')).toBeNull();
});

it('leads a Tab group header with a dot in the colour of the group', () => {
  renderGroup('Tab group');

  const header = screen.getByRole('button', { name: 'Work' });
  expect(header.querySelector('img')).toBeNull();
  expect(header.querySelector('[data-group-dot]')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Work' })).toHaveAttribute('data-color', 'green');
});
