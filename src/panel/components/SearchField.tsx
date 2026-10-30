import { usePanelUi } from '../ui-store';

/** The search field of the bottom bar. Escape or the clear button empties it. */
export function SearchField() {
  const query = usePanelUi((ui) => ui.searchQuery);
  const setQuery = usePanelUi((ui) => ui.setSearchQuery);
  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="search"
        aria-label="Search"
        placeholder="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || query === '') return;
          event.preventDefault();
          setQuery('');
        }}
        className="h-7 w-full appearance-none rounded-md bg-(--favorite-bg) pr-7 pl-2.5 text-(--text) outline-none placeholder:text-(--text-muted) focus-visible:bg-(--row-active) [&::-webkit-search-cancel-button]:hidden"
      />
      {query !== '' && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setQuery('')}
          className="absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded-md text-(--text-muted) hover:bg-(--row-hover)"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
