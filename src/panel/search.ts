import type { ItemView, TabView } from '../shared/types';
import { buildTree, type TreeNode } from './build-tree';

/** A Pinned Tab that matches a search, with the names of the Folders above it, outermost first. */
interface PinnedResult {
  item: ItemView;
  path: string[];
}

export interface ItemResults {
  favorites: ItemView[];
  /** In tree order. A Folder never appears: only its name, in the path of a match. */
  pinned: PinnedResult[];
}

/** True when the query has text other than spaces. Only then does the panel show search results. */
export const isSearching = (query: string): boolean => query.trim() !== '';

/** True when one of the texts contains the query, in any letter case. Spaces around the query do not count. */
export const contains = (query: string, ...texts: string[]) => {
  const needle = query.trim().toLowerCase();
  return texts.some((text) => text.toLowerCase().includes(needle));
};

/** An item matches by its saved title and URL, and by the title and URL of its live tab when that tab is away. */
function itemMatches(item: ItemView, query: string): boolean {
  if (contains(query, item.title, item.url)) return true;
  return Boolean(item.live?.away && contains(query, item.live.title, item.live.url));
}

/** The Unpinned Tabs whose title or URL contains the query, in any letter case. */
export function filterTabs(tabs: TabView[], query: string): TabView[] {
  return tabs.filter((tab) => contains(query, tab.title, tab.url));
}

/** The Favorites and the Pinned Tabs that match the query. A Folder state does not hide a match. */
export function filterItems(items: ItemView[], query: string): ItemResults {
  const favorites = items
    .filter((item) => item.kind === 'favorite' && itemMatches(item, query))
    .sort((a, b) => a.position - b.position);
  const pinned: PinnedResult[] = [];
  const walk = (nodes: TreeNode[], path: string[]) => {
    for (const node of nodes) {
      if (node.item.kind === 'folder') walk(node.children, [...path, node.item.title]);
      else if (itemMatches(node.item, query)) pinned.push({ item: node.item, path });
    }
  };
  walk(buildTree(items), []);
  return { favorites, pinned };
}
