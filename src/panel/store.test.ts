import { beforeEach, expect, it } from 'vitest';
import { makeState } from '../../tests/support/builders';
import { resetPanelStore, usePanelStore } from './store';

beforeEach(resetPanelStore);

it('keeps the latest state that the worker sent', () => {
  const state = makeState();
  usePanelStore.getState().receive(state);
  expect(usePanelStore.getState().state).toBe(state);
});

it('starts with the same state that makeState gives', () => {
  expect(usePanelStore.getState().state).toEqual(makeState());
});
