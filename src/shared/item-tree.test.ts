import { expect, it } from 'vitest';
import { topLevelIds } from './item-tree';
import type { ItemRecord } from './types';

const record = (id: string, parentId: string | null): ItemRecord => ({
  id,
  kind: 'pinned',
  title: id,
  url: '',
  parentId,
  position: 0,
  collapsed: false,
});

const items = [
  record('work', null),
  record('inner', 'work'),
  record('deep', 'inner'),
  record('a', null),
];

it('keeps the ids that stand alone, in the given order', () => {
  expect(topLevelIds(items, ['a', 'work'])).toEqual(['a', 'work']);
});

it('drops an id below another id of the list, at any depth', () => {
  expect(topLevelIds(items, ['deep', 'work', 'inner'])).toEqual(['work']);
});

it('keeps an id whose ancestor is not in the list', () => {
  expect(topLevelIds(items, ['deep', 'a'])).toEqual(['deep', 'a']);
});

it('drops unknown ids and repeated ids', () => {
  expect(topLevelIds(items, ['nope', 'a', 'a'])).toEqual(['a']);
});
