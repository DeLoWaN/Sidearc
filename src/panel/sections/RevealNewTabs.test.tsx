import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, type Mock, vi } from 'vitest';
import { makeState, makeTab } from '../../../tests/support/builders';
import { renderPanel } from '../../../tests/support/render-panel';
import type { SidebarState, TabGroupView, TabView } from '../../shared/types';
import { resetPanelDrag, usePanelDrag } from '../dnd/drag-store';
import { PanelContext } from '../panel-context';
import { resetPanelStore, usePanelStore } from '../store';
import { resetPanelUi } from '../ui-store';
import { UnpinnedSection } from './UnpinnedSection';

// happy-dom has no scrollIntoView and no layout.
let scrollIntoView: Mock<(options?: ScrollIntoViewOptions) => void>;
/** The text of the rows that sit below the visible part of the scroll container. */
let below: string[];

const rect = (top: number, bottom: number) =>
  ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top }) as DOMRect;

beforeEach(() => {
  resetPanelStore();
  resetPanelUi();
  resetPanelDrag();
  below = [];
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.tagName === 'MAIN') return rect(0, 100);
    const text = this.textContent ?? '';
    return below.some((title) => text.startsWith(title)) ? rect(150, 180) : rect(10, 40);
  });
});

afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

function show(state: SidebarState) {
  return renderPanel(
    <main>
      <UnpinnedSection />
    </main>,
    { state },
  );
}

/** The state that the worker sends next. */
const receive = (state: SidebarState) => act(() => usePanelStore.getState().receive(state));

/** The text of the elements that the panel scrolled to. */
const revealed = () =>
  (scrollIntoView.mock.contexts as Element[]).map((element) => element.textContent);

const group = (tabs: TabView[], collapsed: boolean): TabGroupView => ({
  id: 100,
  windowId: 1,
  title: 'Work',
  color: 'blue',
  collapsed,
  tabIds: tabs.map((tab) => tab.id),
});

it('scrolls to a new tab whose row is not fully visible', () => {
  const [a, b] = [makeTab({ title: 'Alpha' }), makeTab({ title: 'Beta' })] as [TabView, TabView];
  show(makeState({ unpinnedTabs: [a, b] }));
  below = ['Gamma'];

  receive(makeState({ unpinnedTabs: [a, b, makeTab({ title: 'Gamma' })] }));

  expect(revealed()).toEqual(['Gamma']);
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
});

it('does not scroll to a new tab whose row is already fully visible', () => {
  const a = makeTab({ title: 'Alpha' });
  show(makeState({ unpinnedTabs: [a] }));

  receive(makeState({ unpinnedTabs: [makeTab({ title: 'Gamma' }), a] }));

  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('scrolls without animation when the user prefers reduced motion', () => {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) => ({ matches: query.includes('reduce') }) as MediaQueryList,
  );
  const a = makeTab({ title: 'Alpha' });
  show(makeState({ unpinnedTabs: [a] }));
  below = ['Gamma'];

  receive(makeState({ unpinnedTabs: [a, makeTab({ title: 'Gamma' })] }));

  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
});

it('does not scroll for the tabs of the first state', () => {
  below = ['Alpha', 'Beta'];

  show(makeState({ unpinnedTabs: [makeTab({ title: 'Alpha' }), makeTab({ title: 'Beta' })] }));

  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('does not scroll for the first state that arrives after the panel rendered', () => {
  render(
    <PanelContext value={{ windowId: 1, send: vi.fn() }}>
      <main>
        <UnpinnedSection />
      </main>
    </PanelContext>,
  );
  below = ['Alpha'];

  receive(makeState({ unpinnedTabs: [makeTab({ title: 'Alpha' })] }));

  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('does not scroll when a tab that was already in the list changes or moves', () => {
  const [a, b] = [makeTab({ title: 'Alpha' }), makeTab({ title: 'Beta' })] as [TabView, TabView];
  show(makeState({ unpinnedTabs: [a, b] }));
  below = ['Alpha'];

  receive(makeState({ unpinnedTabs: [b, { ...a, title: 'Alpha 2' }] }));

  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('scrolls to a new tab inside an open Tab group', () => {
  const [a, b] = [makeTab({ title: 'Alpha' }), makeTab({ title: 'Beta' })] as [TabView, TabView];
  show(makeState({ unpinnedTabs: [a, b], tabGroups: [group([a], false)] }));
  const c = makeTab({ title: 'Gamma' });
  below = ['Gamma'];

  receive(makeState({ unpinnedTabs: [a, c, b], tabGroups: [group([a, c], false)] }));

  expect(revealed()).toEqual(['Gamma']);
});

it('scrolls to the header of a collapsed Tab group for a new tab inside it', () => {
  const a = makeTab({ title: 'Alpha' });
  show(makeState({ unpinnedTabs: [a], tabGroups: [group([a], true)] }));
  const c = makeTab({ title: 'Gamma' });
  below = ['Work'];

  receive(makeState({ unpinnedTabs: [a, c], tabGroups: [group([a, c], true)] }));

  expect(scrollIntoView).toHaveBeenCalledOnce();
  expect((scrollIntoView.mock.contexts[0] as Element).getAttribute('aria-label')).toBe('Work');
});

it('does not scroll for a new tab inside a collapsed Tab group whose header is visible', () => {
  const a = makeTab({ title: 'Alpha' });
  show(makeState({ unpinnedTabs: [a], tabGroups: [group([a], true)] }));
  const c = makeTab({ title: 'Gamma' });

  receive(makeState({ unpinnedTabs: [a, c], tabGroups: [group([a, c], true)] }));

  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('does not scroll while the user drags', () => {
  const a = makeTab({ title: 'Alpha' });
  show(makeState({ unpinnedTabs: [a] }));
  below = ['Gamma'];
  const c = makeTab({ title: 'Gamma' });

  act(() => usePanelDrag.setState({ source: { type: 'tab', tabId: a.id } }));
  receive(makeState({ unpinnedTabs: [a, c] }));
  act(() => resetPanelDrag());
  receive(makeState({ unpinnedTabs: [a, c] }));

  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('scrolls again when a later state pushes the new row out of view', () => {
  const a = makeTab({ title: 'Alpha' });
  show(makeState({ unpinnedTabs: [a] }));
  const c = makeTab({ title: 'Gamma' });
  below = ['Gamma'];
  receive(makeState({ unpinnedTabs: [a, c] }));
  scrollIntoView.mockClear();

  // The worker sends the site group of the two tabs one state later: its header pushes the row down.
  receive(makeState({ unpinnedTabs: [a, { ...c, title: 'Gamma' }] }));

  expect(revealed()).toEqual(['Gamma']);
});

it('stops following the new tab when its row is visible', () => {
  const a = makeTab({ title: 'Alpha' });
  show(makeState({ unpinnedTabs: [a] }));
  const c = makeTab({ title: 'Gamma' });
  below = ['Gamma'];
  receive(makeState({ unpinnedTabs: [a, c] }));
  below = [];
  scrollIntoView.mockClear();

  receive(makeState({ unpinnedTabs: [a, c] }));
  below = ['Gamma'];
  receive(makeState({ unpinnedTabs: [a, c] }));

  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('stops following the new tab after one second', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const a = makeTab({ title: 'Alpha' });
  show(makeState({ unpinnedTabs: [a] }));
  const c = makeTab({ title: 'Gamma' });
  below = ['Gamma'];
  receive(makeState({ unpinnedTabs: [a, c] }));
  scrollIntoView.mockClear();

  vi.advanceTimersByTime(1001);
  receive(makeState({ unpinnedTabs: [a, c] }));

  expect(scrollIntoView).not.toHaveBeenCalled();
  vi.useRealTimers();
});
