import { useState } from 'react';
import { backupFileName } from '../../shared/backup-format';
import { plural } from '../../shared/plural';
import type { BackupSummary } from '../../shared/protocol';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useAsk } from '../options-context';
import { Section } from '../Section';
import { useSettings } from '../settings-context';

function describeSummary(summary: BackupSummary) {
  return [
    plural(summary.favorites, 'Favorite'),
    plural(summary.pinnedTabs, 'Pinned Tab'),
    plural(summary.folders, 'Folder'),
  ]
    .join(', ')
    .concat(` and ${plural(summary.archivedTabs, 'archived tab')}`);
}

const describeFailure = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure);

/** The page saves the text that the worker gives. The page never reads the stored data itself. */
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

type Pending = { text: string; summary: BackupSummary };

/** The JSON backup: export to a file, and import of a file after a confirmation. */
export function BackupSection() {
  const ask = useAsk();
  const { refresh } = useSettings();
  const [pending, setPending] = useState<Pending>();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const clear = () => {
    setPending(undefined);
    setError(undefined);
    setDone(undefined);
  };

  const exportBackup = async () => {
    clear();
    try {
      download(await ask('backup/export', null), backupFileName(new Date()));
    } catch (failure) {
      setError(`The export failed: ${describeFailure(failure)}`);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    clear();
    if (!file) return;
    try {
      const text = await file.text();
      const result = await ask('backup/inspect', text);
      if (result.ok) setPending({ text, summary: result.summary });
      else setError(result.error);
    } catch (failure) {
      setError(`The file could not be checked: ${describeFailure(failure)}`);
    }
  };

  const replaceData = async () => {
    if (!pending) return;
    try {
      const result = await ask('backup/import', pending.text);
      setPending(undefined);
      if (!result.ok) return setError(result.error);
      setDone(`Backup imported: ${describeSummary(result.summary)}.`);
    } catch (failure) {
      setPending(undefined);
      return setError(`The import failed: ${describeFailure(failure)}`);
    }
    await refresh().catch((failure) =>
      setError(`The settings could not be read again: ${describeFailure(failure)}`),
    );
  };

  const button = 'rounded-md px-3 py-1.5 hover:bg-(--row-hover)';

  return (
    <Section title="Backup">
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className={`${button} bg-(--menu-bg)`} onClick={exportBackup}>
          Export backup
        </button>
        <label className="flex items-center gap-2">
          Import backup
          <input
            type="file"
            aria-label="Backup file"
            accept=".json,application/json"
            onChange={(event) => {
              const input = event.currentTarget;
              chooseFile(input.files?.[0]).finally(() => {
                input.value = '';
              });
            }}
          />
        </label>
      </div>
      {pending && (
        <ConfirmDialog
          label="Replace your data?"
          confirmLabel="Replace my data"
          onCancel={clear}
          onConfirm={replaceData}
        >
          This file holds {describeSummary(pending.summary)}. Importing it replaces all your
          Favorites, Pinned Tabs, Folders, settings and View Archive.
        </ConfirmDialog>
      )}
      {error && (
        <p role="alert" className="mt-2 text-(--g-red)">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-2">
          {done}
        </p>
      )}
    </Section>
  );
}
