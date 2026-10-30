import { expect, it } from 'vitest';
import { plural } from './plural';

it.each([
  [0, '0 Folders'],
  [1, '1 Folder'],
  [2, '2 Folders'],
])('writes %i Folder with the right form', (count, text) => {
  expect(plural(count, 'Folder')).toBe(text);
});

it('uses the given plural form when it is not the noun with an s', () => {
  expect(plural(1, 'entry', 'entries')).toBe('1 entry');
  expect(plural(3, 'entry', 'entries')).toBe('3 entries');
});
