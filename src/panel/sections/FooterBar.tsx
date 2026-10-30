import { useArchiveUi } from '../archive-ui-store';

/** The bottom bar. Controls sit in one row: a wider control goes before the archive button. */
export function FooterBar() {
  const openArchive = useArchiveUi((ui) => ui.openArchive);
  return (
    <footer className="flex shrink-0 items-center gap-2 px-2.5 pb-2.5">
      <button
        type="button"
        aria-label="View Archive"
        title="View Archive"
        onClick={openArchive}
        className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-(--text-muted) hover:bg-(--row-hover)"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="1.75" y="2.5" width="12.5" height="3.5" rx="1" />
          <path d="M2.75 6v6.5a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1V6M6.5 9h3" />
        </svg>
      </button>
    </footer>
  );
}
