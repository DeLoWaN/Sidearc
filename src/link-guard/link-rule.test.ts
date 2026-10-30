import { describe, expect, it } from 'vitest';
import { opensOtherHost } from './link-rule';

const PAGE = 'https://jira.iwd.io/browse/A-1';

describe('opensOtherHost', () => {
  it.each([
    ['another domain', 'https://example.com/'],
    ['a different subdomain', 'https://wiki.iwd.io/'],
    ['a parent domain', 'https://iwd.io/'],
    ['a child subdomain', 'https://a.jira.iwd.io/'],
    ['the same name with www.', 'https://www.jira.iwd.io/'],
    ['another port', 'https://jira.iwd.io:8443/'],
    ['http on the same name with another port', 'http://jira.iwd.io:8080/'],
    ['a link with no scheme and another host', '//wiki.iwd.io/x'],
  ])('is true for %s', (_name, link) => {
    expect(opensOtherHost(PAGE, link)).toBe(true);
  });

  it.each([
    ['the same host and another path', 'https://jira.iwd.io/browse/A-2'],
    ['the same host with another query and fragment', 'https://jira.iwd.io/x?y=1#z'],
    ['the same host in capital letters', 'https://JIRA.iwd.io/'],
    ['the same host with the default port written', 'https://jira.iwd.io:443/'],
    ['the same host on http', 'http://jira.iwd.io/'],
    ['a relative path', '/browse/A-3'],
    ['a relative file', 'A-4'],
    ['a fragment only', '#comments'],
    ['a query only', '?page=2'],
    ['a link with no scheme and the same host', '//jira.iwd.io/x'],
  ])('is false for %s', (_name, link) => {
    expect(opensOtherHost(PAGE, link)).toBe(false);
  });

  it('compares the port of the page', () => {
    expect(opensOtherHost('http://localhost:3000/', 'http://localhost:3000/a')).toBe(false);
    expect(opensOtherHost('http://localhost:3000/', 'http://localhost:4000/a')).toBe(true);
    expect(opensOtherHost('http://localhost:3000/', 'http://localhost/a')).toBe(true);
  });

  it.each([
    ['javascript:', 'javascript:void(0)'],
    ['mailto:', 'mailto:someone@other.test'],
    ['tel:', 'tel:+33123456789'],
    ['data:', 'data:text/html,hi'],
    ['blob:', 'blob:https://other.test/abc'],
    ['file:', 'file:///tmp/a.html'],
    ['ftp:', 'ftp://other.test/a'],
    ['an address that is not valid', 'http://'],
  ])('is false for %s', (_name, link) => {
    expect(opensOtherHost(PAGE, link)).toBe(false);
  });

  it('is false when the page address is not an http link', () => {
    expect(opensOtherHost('about:blank', 'https://other.test/')).toBe(false);
    expect(opensOtherHost('not a url', 'https://other.test/')).toBe(false);
  });
});
