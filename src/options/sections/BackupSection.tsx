import { useState } from 'react';
import { backupFileName } from '../../shared/backup-format';
import { plural } from '../../shared/plural';
import type { BackupSummary } from '../../shared/protocol';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { optionsButton } from '../button-style';
import { FilePickerButton } from '../FilePickerButton';
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

  const chooseFile = async (file: File) => {
    clear();
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

  return (
    <Section title="Backup">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="flex max-w-64 flex-col items-start gap-2">
          <button type="button" className={optionsButton} onClick={exportBackup}>
            Export backup
          </button>
          <p className="text-xs text-(--text-muted)">
            Saves your Favorites, Pinned Tabs, Folders, settings and View Archive in one JSON file.
          </p>
        </div>
        <div className="flex max-w-64 flex-col items-start gap-2">
          <FilePickerButton
            buttonLabel="Import backup"
            inputLabel="Backup file"
            accept=".json,application/json"
            className={optionsButton}
            onFile={chooseFile}
          />
          <p className="text-xs text-(--text-muted)">
            Replaces all your Sidesweep data with the content of a backup file. Asks for
            confirmation first.
          </p>
        </div>
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
