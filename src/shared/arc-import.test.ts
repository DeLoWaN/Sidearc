import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importArcSpace, listArcSpaces } from './arc-import';
import type { ItemRecord } from './types';

const fixture = readFileSync('tests/fixtures/arc/StorableSidebar.trimmed.json', 'utf8');
const ALPHA = 'thebrowser.company.defaultPersonalSpaceID';
const BETA = '11111111-2222-4333-8444-555555555555';

/** Makes ids "id-1", "id-2", ... so a test can read the links between items. */
function counter() {
  let n = 0;
  return () => `id-${++n}`;
}

function run(spaceId: string, text = fixture) {
  const result = importArcSpace(text, spaceId, counter());
  if (!result.ok) throw new Error(`Import failed: ${result.error}`);
  return result;
}

/** The items as a nested list of "kind title" lines, in display order, indented by depth. */
function outline(items: ItemRecord[], kind: 'favorite' | 'tree') {
  const lines: string[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const children = items
      .filter((item) => item.parentId === parentId && item.kind !== 'favorite')
      .sort((a, b) => a.position - b.position);
    for (const item of children) {
      lines.push(`${'  '.repeat(depth)}${item.kind} ${item.title}`);
      walk(item.id, depth + 1);
    }
  };
  if (kind === 'favorite') {
    return items
      .filter((item) => item.kind === 'favorite')
      .sort((a, b) => a.position - b.position)
      .map((item) => item.title);
  }
  walk(null, 0);
  return lines;
}

describe('listArcSpaces', () => {
  it('lists the id and the title of each space of the file', () => {
    expect(listArcSpaces(fixture)).toEqual({
      ok: true,
      spaces: [
        { id: ALPHA, title: 'Alpha' },
        { id: BETA, title: 'Beta' },
      ],
    });
  });

  it('refuses text that is not JSON', () => {
    expect(listArcSpaces('not json {')).toEqual({
      ok: false,
      error: 'The file is not valid JSON.',
    });
  });

  it('refuses JSON that is not an Arc sidebar and names what is missing', () => {
    expect(listArcSpaces('{"hello":"world"}')).toEqual({
      ok: false,
      error: 'This is not an Arc sidebar file: "sidebar.containers" is missing.',
    });
    expect(listArcSpaces('[1,2]')).toEqual({
      ok: false,
      error: 'This is not an Arc sidebar file: the top level is not an object.',
    });
    expect(listArcSpaces('{"sidebar":{"containers":[{"global":{}}]}}')).toEqual({
      ok: false,
      error: 'This is not an Arc sidebar file: no container with "spaces" and "items".',
    });
  });
});

describe('importArcSpace', () => {
  it('imports the Pinned Tabs and Folders of the space with their nesting', () => {
    const { items } = run(ALPHA);

    expect(outline(items, 'tree')).toEqual([
      'pinned Example Docs',
      'pinned My wiki',
      'folder Work',
      '  pinned Board',
      '  folder Projects',
      '    pinned Tracker',
      '    folder 2026',
      '      pinned Plan',
      '      folder Old',
      '        pinned Report one',
      '        pinned Report two',
      'folder Reading',
      '  pinned News',
      '  pinned Blog',
    ]);
  });

  it('uses the title that the user gave, else the saved title of the page', () => {
    const { items } = run(ALPHA);
    const titles = items.map((item) => item.title);

    expect(titles).toContain('My wiki');
    expect(titles).not.toContain('Wiki page title');
    expect(titles).toContain('Example Docs');
  });

  it('keeps the saved URL of each Pinned Tab and gives a Folder no URL', () => {
    const { items } = run(ALPHA);

    expect(items.find((item) => item.title === 'My wiki')?.url).toBe(
      'https://wiki.example.test/home',
    );
    expect(items.find((item) => item.title === 'Plan')?.url).toBe('http://plan.example.test/q1');
    expect(items.find((item) => item.title === 'Work')?.url).toBe('');
  });

  it('links each item to its Folder and numbers the items of a parent from 0', () => {
    const { items } = run(ALPHA, fixture);
    const work = items.find((item) => item.title === 'Work') as ItemRecord;
    const children = items.filter((item) => item.parentId === work.id);

    expect(children.map((item) => [item.title, item.position])).toEqual([
      ['Board', 0],
      ['Projects', 1],
    ]);
    expect(items.filter((item) => item.parentId === null && item.kind !== 'favorite')).toHaveLength(
      4,
    );
    expect(items.every((item) => !item.collapsed)).toBe(true);
  });

  it('makes a new id for each item', () => {
    const result = importArcSpace(fixture, ALPHA);
    if (!result.ok) throw new Error(result.error);
    const ids = result.items.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => !id.startsWith('aaaaaaaa'))).toBe(true);
  });

  it('imports the Favorites of the profile linked to the space, in order, with no parent', () => {
    const { items } = run(ALPHA);

    expect(outline(items, 'favorite')).toEqual(['Mail', 'Chat', 'Calendar']);
    expect(items.filter((item) => item.kind === 'favorite').map((item) => item.parentId)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('takes the Favorites of the other profile for the other space', () => {
    const { items, report } = run(BETA);

    expect(outline(items, 'favorite')).toEqual(
      Array.from({ length: 12 }, (_, n) => `Favorite ${n + 1}`),
    );
    expect(outline(items, 'tree')).toEqual(['pinned Beta home', 'folder Empty folder']);
    expect(report.favorites).toBe(12);
  });

  it('ignores the Favorites beyond 12 and counts them', () => {
    const { report } = run(BETA);

    expect(report).toMatchObject({ favorites: 12, favoritesIgnored: 2 });
  });

  it('skips Arc-only items and tabs that Chrome cannot open, and counts them', () => {
    const { items, report } = run(ALPHA);

    const titles = items.map((item) => item.title);
    for (const skipped of ['Sketch', 'Scratch note', 'Browser settings', 'Today tab']) {
      expect(titles).not.toContain(skipped);
    }
    expect(report.skipped).toBe(3);
  });

  it('reports the counts of Favorites, Pinned Tabs and Folders', () => {
    expect(run(ALPHA).report).toEqual({
      favorites: 3,
      pinnedTabs: 9,
      folders: 5,
      favoritesIgnored: 0,
      skipped: 3,
    });
    expect(run(BETA).report).toEqual({
      favorites: 12,
      pinnedTabs: 1,
      folders: 1,
      favoritesIgnored: 2,
      skipped: 0,
    });
  });

  it('refuses a space that is not in the file', () => {
    expect(importArcSpace(fixture, 'nope')).toEqual({
      ok: false,
      error: 'The file has no space with the id "nope".',
    });
  });

  it('refuses a file that is not an Arc sidebar', () => {
    expect(importArcSpace('{"a":1}', ALPHA)).toEqual({
      ok: false,
      error: 'This is not an Arc sidebar file: "sidebar.containers" is missing.',
    });
    expect(importArcSpace('oops', ALPHA)).toEqual({
      ok: false,
      error: 'The file is not valid JSON.',
    });
  });

  it('refuses a space with no container of Pinned Tabs', () => {
    const broken = JSON.parse(fixture);
    const space = broken.sidebar.containers[1].spaces[1];
    space.containerIDs = [];
    space.newContainerIDs = [];

    expect(importArcSpace(JSON.stringify(broken), ALPHA)).toEqual({
      ok: false,
      error: 'The space has no container of Pinned Tabs.',
    });
  });

  it('refuses a tree where an item is its own ancestor, instead of looping', () => {
    const broken = JSON.parse(fixture);
    const list = broken.sidebar.containers[1].items;
    const folder = list.find(
      (entry: unknown) =>
        typeof entry === 'object' && (entry as { title: string }).title === 'Work',
    );
    folder.childrenIds.push(folder.id);

    const result = importArcSpace(JSON.stringify(broken), ALPHA);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/appears twice/);
  });
});
