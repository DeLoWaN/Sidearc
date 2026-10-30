/**
 * Reads the `StorableSidebar.json` file of the Arc browser. Pure TypeScript: no browser API here.
 * Arc writes each list of objects as a flat array that alternates an id and the object of that id.
 */
import { MAX_FAVORITES } from './item-tree';
import type { ItemRecord } from './types';
import { type Fail, fail, isObject } from './validation';

export interface ArcSpace {
  id: string;
  title: string;
}

/** What an import brought in, and what it left out. */
export interface ArcImportReport {
  favorites: number;
  pinnedTabs: number;
  folders: number;
  /** Favorites of the profile beyond the 12 that Sidesweep keeps. */
  favoritesIgnored: number;
  /** Arc-only items (Live Folders, easels, notes...) and tabs that Chrome cannot open. */
  skipped: number;
}

export type ArcImportResult = { ok: true; report: ArcImportReport } | { ok: false; error: string };

type Json = Record<string, unknown>;

const NOT_ARC = 'This is not an Arc sidebar file:';

/** Compares two JSON values, whatever the order of the keys. */
function sameJson(a: unknown, b: unknown): boolean {
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => sameJson(a[key], b[key]));
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => sameJson(value, b[i]));
  }
  return a === b;
}

/** Splits an Arc list into its pairs. Each pair holds a key (an id or a marker) and its value. */
function pairs(list: unknown): [unknown, unknown][] {
  if (!Array.isArray(list)) return [];
  const result: [unknown, unknown][] = [];
  for (let i = 0; i + 1 < list.length; i += 2) result.push([list[i], list[i + 1]]);
  return result;
}

interface Sidebar {
  spaces: Json[];
  /** The Favorites containers, each with the Arc profile it belongs to. */
  topApps: { profile: unknown; containerId: string }[];
  objects: Map<string, Json>;
}

function readSidebar(text: string): { ok: true; sidebar: Sidebar } | Fail {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return fail('The file is not valid JSON.');
  }
  if (!isObject(root)) return fail(`${NOT_ARC} the top level is not an object.`);
  const containers = isObject(root.sidebar) ? root.sidebar.containers : undefined;
  if (!Array.isArray(containers)) return fail(`${NOT_ARC} "sidebar.containers" is missing.`);
  const main = containers.find(
    (container): container is Json =>
      isObject(container) && Array.isArray(container.spaces) && Array.isArray(container.items),
  );
  if (!main) return fail(`${NOT_ARC} no container with "spaces" and "items".`);

  const objects = new Map<string, Json>();
  for (const [id, object] of pairs(main.items)) {
    if (typeof id === 'string' && isObject(object)) objects.set(id, object);
  }
  const spaces = pairs(main.spaces)
    .map(([, space]) => space)
    .filter(isObject);
  const topApps = pairs(main.topAppsContainerIDs)
    .filter((pair): pair is [unknown, string] => typeof pair[1] === 'string')
    .map(([profile, containerId]) => ({ profile, containerId }));
  return { ok: true, sidebar: { spaces, topApps, objects } };
}

/** The spaces of the file, for the user to choose one. */
export function listArcSpaces(text: string): { ok: true; spaces: ArcSpace[] } | Fail {
  const read = readSidebar(text);
  if (!read.ok) return read;
  const spaces = read.sidebar.spaces
    .filter((space) => typeof space.id === 'string')
    .map((space) => ({
      id: space.id as string,
      title: typeof space.title === 'string' && space.title ? space.title : 'Untitled space',
    }));
  return { ok: true, spaces };
}

/** The id that follows the given marker in a list of markers and ids. */
function containerAfter(space: Json, kind: 'pinned' | 'unpinned'): string | undefined {
  for (const [marker, id] of pairs(space.containerIDs)) {
    if (marker === kind && typeof id === 'string') return id;
  }
  for (const [marker, id] of pairs(space.newContainerIDs)) {
    if (isObject(marker) && kind in marker && typeof id === 'string') return id;
  }
  return undefined;
}

const childrenOf = (object: Json): string[] =>
  Array.isArray(object.childrenIds)
    ? object.childrenIds.filter((id): id is string => typeof id === 'string')
    : [];

/** The title that the user sees: the title that the user gave, else the title of the saved page. */
function tabTitle(object: Json, saved: Json, url: string): string {
  for (const candidate of [object.title, saved.savedTitle]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return url;
}

type Walked = { kind: 'tab'; title: string; url: string } | { kind: 'folder'; title: string };

/** Reads an Arc item as a Sidesweep tab or folder. Returns undefined for an Arc-only item. */
function readItem(object: Json): Walked | undefined {
  const data = isObject(object.data) ? object.data : {};
  if (isObject(data.list)) {
    const title =
      typeof object.title === 'string' && object.title.trim() ? object.title.trim() : '';
    return { kind: 'folder', title: title || 'Folder' };
  }
  const saved = data.tab;
  if (!isObject(saved) || typeof saved.savedURL !== 'string') return undefined;
  const url = saved.savedURL;
  // Chrome cannot open the internal pages of Arc.
  if (!/^https?:/i.test(url)) return undefined;
  return { kind: 'tab', title: tabTitle(object, saved, url), url };
}

/**
 * Makes the items of one Arc space: its Pinned Tabs and Folders, and the Favorites of its profile.
 * `newId` makes the ids of the new items. Nothing is returned when the file is refused.
 */
export function importArcSpace(
  text: string,
  spaceId: string,
  newId: () => string = () => crypto.randomUUID(),
): { ok: true; items: ItemRecord[]; report: ArcImportReport } | Fail {
  const read = readSidebar(text);
  if (!read.ok) return read;
  const { spaces, topApps, objects } = read.sidebar;
  const space = spaces.find((candidate) => candidate.id === spaceId);
  if (!space) return fail(`The file has no space with the id "${spaceId}".`);
  const pinnedId = containerAfter(space, 'pinned');
  const pinned = pinnedId === undefined ? undefined : objects.get(pinnedId);
  if (!pinned) return fail('The space has no container of Pinned Tabs.');

  const items: ItemRecord[] = [];
  const report: ArcImportReport = {
    favorites: 0,
    pinnedTabs: 0,
    folders: 0,
    favoritesIgnored: 0,
    skipped: 0,
  };
  const visited = new Set<string>();

  const add = (
    walked: Walked,
    kind: ItemRecord['kind'],
    parentId: string | null,
    position: number,
  ) => {
    const item: ItemRecord = {
      id: newId(),
      kind,
      title: walked.title,
      url: walked.kind === 'tab' ? walked.url : '',
      parentId,
      position,
      collapsed: false,
    };
    items.push(item);
    return item;
  };

  const countSkipped = (id: string): void => {
    const object = objects.get(id);
    if (!object) return;
    report.skipped += 1;
    for (const childId of childrenOf(object)) countSkipped(childId);
  };

  let failure: Fail | undefined;
  const walk = (parentArcId: string, parentId: string | null) => {
    let position = 0;
    for (const id of childrenOf(objects.get(parentArcId) as Json)) {
      const object = objects.get(id);
      if (!object) continue;
      if (visited.has(id)) {
        failure = fail(`The Arc item "${id}" appears twice in the tree.`);
        return;
      }
      visited.add(id);
      const walked = readItem(object);
      if (!walked) {
        countSkipped(id);
        continue;
      }
      if (walked.kind === 'folder') {
        const folder = add(walked, 'folder', parentId, position++);
        report.folders += 1;
        walk(id, folder.id);
      } else {
        add(walked, 'pinned', parentId, position++);
        report.pinnedTabs += 1;
      }
      if (failure) return;
    }
  };
  walk(pinnedId as string, null);
  if (failure) return failure;

  const favoritesContainer = topApps.find((top) => sameJson(top.profile, space.profile));
  if (favoritesContainer && objects.has(favoritesContainer.containerId)) {
    for (const id of childrenOf(objects.get(favoritesContainer.containerId) as Json)) {
      const object = objects.get(id);
      const walked = object && readItem(object);
      if (walked?.kind !== 'tab') {
        report.skipped += 1;
      } else if (report.favorites >= MAX_FAVORITES) {
        report.favoritesIgnored += 1;
      } else {
        add(walked, 'favorite', null, report.favorites);
        report.favorites += 1;
      }
    }
  }
  return { ok: true, items, report };
}
