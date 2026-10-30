import { expect, it } from 'vitest';
import { sameUrl } from './url';

it.each([
  ['https://x.com', 'https://x.com/'],
  ['https://X.com/a', 'https://x.com/a'],
  ['https://x.com:443/a', 'https://x.com/a'],
  ['https://x.com/a?q=1#top', 'https://x.com/a?q=1#top'],
])('treats %s and %s as the same address', (a, b) => {
  expect(sameUrl(a, b)).toBe(true);
  expect(sameUrl(b, a)).toBe(true);
});

it.each([
  ['https://x.com/a', 'https://x.com/b'],
  ['https://x.com/a#one', 'https://x.com/a#two'],
  ['https://x.com/a', 'https://x.com/a#one'],
  ['https://x.com/a?q=1', 'https://x.com/a?q=2'],
  ['http://x.com/', 'https://x.com/'],
])('keeps %s and %s apart', (a, b) => {
  expect(sameUrl(a, b)).toBe(false);
});

it('falls back to string equality when an address does not parse', () => {
  expect(sameUrl('not a url', 'not a url')).toBe(true);
  expect(sameUrl('not a url', 'not a url/')).toBe(false);
  expect(sameUrl('not a url', 'https://x.com/')).toBe(false);
});
