import { describe, expect, it } from 'vitest';
import { makeItem, makeTab } from '../../tests/support/builders';
import { filterItems, filterTabs, isSearching } from './search';

const folder = (overrides: Parameters<typeof makeItem>[0] = {}) =>
  makeItem({ kind: 'folder', url: '', ...overrides });

describe('isSearching', () => {
  it('is false for an empty query and for a query of spaces', () => {
    expect(isSearching('')).toBe(false);
    expect(isSearching('   ')).toBe(false);
    expect(isSearching(' a ')).toBe(true);
  });
});

describe('filterTabs', () => {
  it('keeps the tabs whose title or URL contains the query, in any letter case', () => {
    const byTitle = makeTab({ title: 'Quarterly Report', url: 'https://a.test/' });
    const byUrl = makeTab({ title: 'Home', url: 'https://wiki.test/REPORT/index' });
    const other = makeTab({ title: 'Mail', url: 'https://mail.test/' });

    expect(filterTabs([byTitle, byUrl, other], 'report')).toEqual([byTitle, byUrl]);
  });

  it('ignores spaces around the query', () => {
    const tab = makeTab({ title: 'Mail' });

    expect(filterTabs([tab], '  mail ')).toEqual([tab]);
  });
});

describe('filterItems', () => {
  it('keeps the Favorites that match by title or saved URL', () => {
    const byTitle = makeItem({ kind: 'favorite', title: 'Gmail', url: 'https://x.test/' });
    const byUrl = makeItem({ kind: 'favorite', title: 'Docs', url: 'https://mail.test/' });
    const other = makeItem({ kind: 'favorite', title: 'Maps', url: 'https://maps.test/' });

    const { favorites } = filterItems([byTitle, byUrl, other], 'mail');

    expect(favorites).toEqual([byTitle, byUrl]);
  });

  it('keeps a root Pinned Tab that matches, with an empty Folder path', () => {
    const wiki = makeItem({ title: 'Wiki' });
    const mail = makeItem({ title: 'Mail' });

    const { pinned } = filterItems([wiki, mail], 'wik');

    expect(pinned).toEqual([{ item: wiki, path: [] }]);
  });

  it('shows a match inside collapsed Folders with the names of all its ancestors', () => {
    const work = folder({ title: 'Work', collapsed: true });
    const docs = folder({ title: 'Docs', parentId: work.id, collapsed: true });
    const spec = makeItem({ title: 'Spec', parentId: docs.id });

    const { pinned } = filterItems([work, docs, spec], 'spec');

    expect(pinned).toEqual([{ item: spec, path: ['Work', 'Docs'] }]);
  });

  it('shows no Folder: a Folder without a match is hidden and an ancestor is only a path', () => {
    const work = folder({ title: 'Work' });
    const empty = folder({ title: 'Empty' });
    const mail = makeItem({ title: 'Mail', parentId: work.id });
    const other = makeItem({ title: 'Other', parentId: empty.id });

    const { pinned } = filterItems([work, empty, mail, other], 'mail');

    expect(pinned.map((entry) => entry.item.title)).toEqual(['Mail']);
  });

  it('lists the Pinned Tabs in tree order, each level by position', () => {
    const work = folder({ title: 'Work', position: 1 });
    const inWork = makeItem({ title: 'b-in-work', parentId: work.id });
    const rootFirst = makeItem({ title: 'a-root', position: 0 });
    const rootLast = makeItem({ title: 'c-root', position: 2 });

    const { pinned } = filterItems([rootLast, inWork, work, rootFirst], '-');

    expect(pinned.map((entry) => entry.item.title)).toEqual(['a-root', 'b-in-work', 'c-root']);
  });

  it('matches the current title and URL of a live tab that navigated away', () => {
    const away = makeItem({
      title: 'Saved',
      url: 'https://saved.test/',
      live: { away: true, title: 'Inbox 3', url: 'https://mail.test/inbox' },
    });
    const atRest = makeItem({ title: 'Rest', url: 'https://rest.test/' });

    expect(filterItems([away, atRest], 'inbox').pinned.map((e) => e.item)).toEqual([away]);
    expect(filterItems([away, atRest], 'mail.test').pinned.map((e) => e.item)).toEqual([away]);
  });

  it('does not match the live tab when it is still on the saved page', () => {
    const home = makeItem({
      title: 'Saved',
      url: 'https://saved.test/',
      live: { away: false, title: 'Page loaded title', url: 'https://saved.test/' },
    });

    expect(filterItems([home], 'loaded').pinned).toEqual([]);
  });

  it('lists an item whose parent is missing as a root item', () => {
    const lost = makeItem({ title: 'Lost', parentId: 'gone' });

    expect(filterItems([lost], 'zzz')).toEqual({ favorites: [], pinned: [] });
    expect(filterItems([lost], 'lost').pinned).toEqual([{ item: lost, path: [] }]);
  });
});
