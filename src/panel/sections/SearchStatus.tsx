import { useSearchResults } from '../use-search-results';

/** Tells the user when a search matches nothing. It shows only then, so other status messages stay unique. */
export function SearchStatus() {
  const results = useSearchResults();
  if (!results || results.favorites.length + results.pinned.length + results.tabs.length > 0) {
    return null;
  }
  return (
    <p role="status" className="px-2.5 py-3 text-(--text-muted)">
      No results
    </p>
  );
}
