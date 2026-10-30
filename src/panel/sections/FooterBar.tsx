import { useArchiveUi } from '../archive-ui-store';
import { usePanel } from '../panel-context';

/** The bottom bar. Controls sit in one row: a wider control goes before the archive button. */
export function FooterBar() {
  const { send } = usePanel();
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
      <button
        type="button"
        aria-label="Options"
        title="Options"
        onClick={() => send({ type: 'options/open' })}
        className="grid size-7 shrink-0 place-items-center rounded-md text-(--text-muted) hover:bg-(--row-hover)"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        >
          <path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" />
          <circle cx="10.5" cy="4.5" r="1.5" />
          <circle cx="5.5" cy="11.5" r="1.5" />
        </svg>
      </button>
    </footer>
  );
}
