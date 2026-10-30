import { expect, it } from 'vitest';
import { findNewTabIds } from './use-reveal-new-tabs';

it('gives the ids that were not in the list before, in the order of the new list', () => {
  expect(findNewTabIds(new Set([1, 2, 3]), [9, 1, 2, 7, 3])).toEqual([9, 7]);
});

it('gives nothing when the list has the same tabs in another order', () => {
  expect(findNewTabIds(new Set([1, 2, 3]), [3, 1, 2])).toEqual([]);
});

it('gives nothing when tabs left the list', () => {
  expect(findNewTabIds(new Set([1, 2, 3]), [2])).toEqual([]);
});

it('gives every id when the list was empty', () => {
  expect(findNewTabIds(new Set(), [4, 5])).toEqual([4, 5]);
});
