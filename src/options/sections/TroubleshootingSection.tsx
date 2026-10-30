import { useEffect, useState } from 'react';
import type { PlacementLogEntry } from '../../shared/protocol';
import { optionsButton } from '../button-style';
import { useAsk } from '../options-context';

/** How long "Copied" shows on the copy button. */
const COPIED_MS = 2000;

const describeFailure = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure);

const quote = (text: string) => JSON.stringify(text);

/** One line of text for one entry, with every value that Chrome sent. */
function formatEntry(entry: PlacementLogEntry) {
  const looked = [
    entry.time,
    entry.event,
    `tab=${entry.tabId}`,
    `window=${entry.windowId}`,
    `index=${entry.index}`,
    `opener=${entry.openerTabId ?? 'none'}`,
    `url=${quote(entry.url)}`,
    `pending=${quote(entry.pendingUrl)}`,
    `status=${entry.status || 'none'}`,
    `active=${entry.active}`,
  ];
  const decided = `${entry.decision}: ${entry.reason}`;
  return [...looked, '->', decided, ...(entry.moveResult ? [`(${entry.moveResult})`] : [])].join(
    ' ',
  );
}

/**
 * A closed block at the bottom of the page. Opened, it shows what Chrome sent for the last new tabs
 * and what Sidesweep did, as text that the user can copy and send.
 */
export function TroubleshootingSection() {
  const ask = useAsk();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  const load = () => {
    setError(undefined);
    ask('diagnostics/get', null).then(
      (entries) => setText(entries.map(formatEntry).join('\n')),
      (failure) => setError(`The log could not be read: ${describeFailure(failure)}`),
    );
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the log is read each time the block opens, not each time `ask` changes.
  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text ?? '');
      setError(undefined);
      setCopied(true);
    } catch {
      setError('Sidesweep could not copy the text. Select it and copy it by hand.');
    }
  };

  return (
    <details
      className="mt-4 rounded-[12px] bg-(--row-active) p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-semibold">Troubleshooting</summary>
      {text !== undefined && (
        <pre
          role="log"
          aria-label="Log of new tabs"
          className="mt-2 max-h-64 overflow-auto rounded-lg bg-(--menu-bg) p-2 text-xs whitespace-pre-wrap"
        >
          {text || 'Nothing recorded yet.'}
        </pre>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" className={optionsButton} onClick={copy} disabled={!text}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className={optionsButton} onClick={load}>
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-(--g-red)">
          {error}
        </p>
      )}
    </details>
  );
}
