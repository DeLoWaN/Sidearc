import { useMemo } from 'react';
import type { TabView } from '../shared/types';
import { filterItems, filterTabs, type ItemResults, isSearching } from './search';
import { usePanelStore } from './store';
import { usePanelUi } from './ui-store';

export interface SearchResults extends ItemResults {
  tabs: TabView[];
}

/** What the search field matches in the panel state, or null while the field is empty. */
export function useSearchResults(): SearchResults | null {
  const query = usePanelUi((ui) => ui.searchQuery);
  const items = usePanelStore((store) => store.state.items);
  const tabs = usePanelStore((store) => store.state.unpinnedTabs);
  return useMemo(
    () =>
      isSearching(query) ? { ...filterItems(items, query), tabs: filterTabs(tabs, query) } : null,
    [query, items, tabs],
  );
}
