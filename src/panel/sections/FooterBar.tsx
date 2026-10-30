import { useArchiveUi } from '../archive-ui-store';
import { SearchField } from '../components/SearchField';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';

/** The bottom bar. Controls sit in one row: a wider control goes before the archive button. */
export function FooterBar() {
  const { send } = usePanel();
  const openArchive = useArchiveUi((ui) => ui.openArchive);
  const undo = usePanelStore((store) => store.state.undo);
  return (
    <footer className="flex shrink-0 items-center gap-2 px-2.5 pb-2.5">
      <SearchField />
      <button
        type="button"
        disabled={!undo}
        title={undo ? `Undo ${undo.label}` : 'Nothing to undo'}
        onClick={() => send({ type: 'undo' })}
        className="flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-(--text-muted) hover:bg-(--row-hover) disabled:opacity-40 disabled:hover:bg-transparent"
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
          <path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H6M3 6.5l3-3M3 6.5l3 3" />
        </svg>
        Undo
      </button>
      <button
        type="button"
        aria-label="View Archive"
        title="View Archive"
        onClick={openArchive}
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
