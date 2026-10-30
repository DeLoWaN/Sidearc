import { useSearchResults } from '../use-search-results';

/** Tells the user when a search matches nothing. It stays in the page so a screen reader announces it. */
export function SearchStatus() {
  const results = useSearchResults();
  const empty =
    results && results.favorites.length + results.pinned.length + results.tabs.length === 0;
  return (
    <p role="status" className={empty ? 'px-2.5 py-3 text-(--text-muted)' : 'sr-only'}>
      {empty ? 'No results' : ''}
    </p>
  );
}
