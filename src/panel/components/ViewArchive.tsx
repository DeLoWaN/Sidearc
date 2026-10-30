import { useEffect, useRef, useState } from 'react';
import type { ArchiveEntry } from '../../shared/types';
import { useArchiveUi } from '../archive-ui-store';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { SiteIcon } from './SiteIcon';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

/** "5 minutes ago". Shows "just now" under one minute. */
function formatClosedAt(closedAt: number): string {
  const age = Date.now() - closedAt;
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return relative.format(-Math.floor(age / MINUTE), 'minute');
  if (age < DAY) return relative.format(-Math.floor(age / HOUR), 'hour');
  return relative.format(-Math.floor(age / DAY), 'day');
}

const matches = (entry: ArchiveEntry, query: string) =>
  entry.title.toLowerCase().includes(query) || entry.url.toLowerCase().includes(query);

/** The list of closed tabs, with a search by title and URL. A click on an entry reopens the tab. */
export function ViewArchive() {
  const { send } = usePanel();
  const archive = usePanelStore((store) => store.state.archive);
  const { open, closeArchive } = useArchiveUi();
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && closeArchive();
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, closeArchive]);

  useEffect(() => {
    if (open) search.current?.focus();
    else setQuery('');
  }, [open]);

  if (!open) return null;

  const needle = query.trim().toLowerCase();
  const shown = archive.filter((entry) => matches(entry, needle));

  return (
    <div
      role="dialog"
      aria-label="View Archive"
      className="panel-background fixed inset-0 z-20 flex flex-col gap-2 p-2.5"
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="font-semibold">View Archive</h2>
        <button
          type="button"
          aria-label="Close View Archive"
          onClick={closeArchive}
          className="grid size-6 place-items-center rounded-md text-(--text-muted) hover:bg-(--row-hover)"
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
      </div>
      <input
        ref={search}
        type="search"
        aria-label="Search archive"
        placeholder="Search by title or URL"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8 rounded-[10px] bg-(--row-active) px-3 outline-none"
      />
      {shown.length === 0 ? (
        <p className="px-2 py-3 text-(--text-muted)">
          {archive.length === 0 ? 'No archived tabs' : 'No match'}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {shown.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                title={entry.url}
                onClick={() => {
                  send({ type: 'archive/reopen', entryId: entry.id });
                  closeArchive();
                }}
                className="flex h-(--row-height) w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left hover:bg-(--row-hover)"
              >
                <SiteIcon iconUrl={entry.iconUrl} title={entry.title} />
                <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                <span className="shrink-0 text-[11px] text-(--text-muted)">
                  {formatClosedAt(entry.closedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
