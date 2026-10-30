import { useEffect, useMemo, useState } from 'react';
import {
  type ArcImportReport,
  type ArcSpace,
  importArcSpace,
  listArcSpaces,
} from '../../shared/arc-import';
import { MAX_FAVORITES } from '../../shared/item-tree';
import { plural } from '../../shared/plural';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { optionsButton, optionsField } from '../button-style';
import { FilePickerButton } from '../FilePickerButton';
import { useAsk } from '../options-context';
import { Section } from '../Section';

/** Where Arc keeps the sidebar. The folder is hidden, so the page gives the path to type in the file window. */
const ARC_FILE_PATH = '~/Library/Application Support/Arc/StorableSidebar.json';

/** How long "Copied" shows on the copy button. */
const COPIED_MS = 2000;

const describeFailure = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure);

function Report({ report }: { report: ArcImportReport }) {
  return (
    <div role="status" className="mt-2">
      <p>
        Imported {plural(report.favorites, 'Favorite')}, {plural(report.pinnedTabs, 'Pinned Tab')}{' '}
        and {plural(report.folders, 'Folder')}.
      </p>
      {report.favoritesIgnored > 0 && (
        <p>
          {plural(report.favoritesIgnored, 'Favorite')} left out: Sidearc keeps {MAX_FAVORITES}{' '}
          Favorites at most.
        </p>
      )}
      {report.skipped > 0 && <p>{plural(report.skipped, 'Arc-only item')} skipped.</p>}
    </div>
  );
}

/** The path in a box, with a button that copies it. The button says "Copied" for two seconds. */
function ArcPath({ onError }: { onError: (message: string | undefined) => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ARC_FILE_PATH);
      onError(undefined);
      setCopied(true);
    } catch {
      onError('Sidearc could not copy the path. Select it and copy it by hand.');
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="rounded-lg border border-(--text-muted)/50 bg-(--menu-bg) px-2 py-1 font-mono text-xs break-all select-all">
        {ARC_FILE_PATH}
      </code>
      <button type="button" className={optionsButton} onClick={copy}>
        {copied ? 'Copied' : 'Copy path'}
      </button>
    </div>
  );
}

/** The question before the import replaces the items that Sidearc holds. */
function ReplaceQuestion({
  itemCount,
  spaceTitle,
  onConfirm,
  onCancel,
}: {
  itemCount: number;
  spaceTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      label="Replace your Favorites, Pinned Tabs and Folders?"
      confirmLabel="Replace my data"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      Replace your Favorites, Pinned Tabs and Folders? Sidearc has {plural(itemCount, 'item')} now.
      The import replaces them with the Arc space "{spaceTitle}". Export a backup first if you want
      to keep them.
    </ConfirmDialog>
  );
}

/**
 * The Arc import: a guide in four steps, then the file, the space and the import.
 * It runs at any time. When Sidearc holds items, the import replaces them after a question.
 */
export function ArcImportSection() {
  const ask = useAsk();
  const [text, setText] = useState<string>();
  const [spaces, setSpaces] = useState<ArcSpace[]>([]);
  const [spaceId, setSpaceId] = useState('');
  const [error, setError] = useState<string>();
  const [report, setReport] = useState<ArcImportReport>();
  const [itemCountToReplace, setItemCountToReplace] = useState<number>();

  const preview = useMemo(() => {
    const imported = text !== undefined && spaceId ? importArcSpace(text, spaceId) : undefined;
    return imported?.ok ? imported.report : undefined;
  }, [text, spaceId]);

  const chooseFile = async (file: File) => {
    setText(undefined);
    setSpaces([]);
    setSpaceId('');
    setError(undefined);
    setReport(undefined);
    try {
      const content = await file.text();
      const listed = listArcSpaces(content);
      if (!listed.ok) return setError(listed.error);
      setText(content);
      setSpaces(listed.spaces);
    } catch (failure) {
      setError(`Sidearc could not read the file: ${describeFailure(failure)}`);
    }
  };

  const replaceItems = async () => {
    setItemCountToReplace(undefined);
    if (text === undefined) return;
    try {
      const result = await ask('arc-import/run', { text, spaceId });
      if (!result.ok) return setError(result.error);
      setError(undefined);
      setReport(result.report);
      // The next import needs a new choice of file and space.
      setText(undefined);
      setSpaces([]);
      setSpaceId('');
    } catch (failure) {
      setError(`The import failed: ${describeFailure(failure)}`);
    }
  };

  // The page reads the number of items now, because the user may have pinned a tab since the page opened.
  const startImport = async () => {
    setReport(undefined);
    setError(undefined);
    try {
      const { itemCount } = await ask('arc-import/status', null);
      if (itemCount === 0) await replaceItems();
      else setItemCountToReplace(itemCount);
    } catch (failure) {
      setError(`The import failed: ${describeFailure(failure)}`);
    }
  };

  return (
    <Section title="Import from Arc">
      <ol className="flex list-decimal flex-col gap-4 pl-5">
        <li>Sidearc reads the file where Arc keeps your sidebar. Arc can stay open.</li>
        <li>
          Click <strong>Choose Arc file</strong>. In the file window, press ⌘ Shift G, paste the
          path below, press Enter, then click Open.
          <ArcPath onError={setError} />
          <div className="mt-2">
            <FilePickerButton
              buttonLabel="Choose Arc file"
              inputLabel="Arc sidebar file"
              accept=".json,application/json"
              className={optionsButton}
              onFile={chooseFile}
            />
          </div>
        </li>
        <li>
          Pick the Arc space to import. Sidearc imports one space. Each Chrome profile has its own
          Sidearc data, so import 'Perso' in your Perso profile and 'IWD' in your IWD profile.
          {spaces.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <label className="flex flex-col gap-1">
                Arc space
                <select
                  value={spaceId}
                  onChange={(event) => setSpaceId(event.target.value)}
                  className={`self-start ${optionsField}`}
                >
                  <option value="">Choose a space</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.title}
                    </option>
                  ))}
                </select>
              </label>
              {preview && (
                <p className="text-xs text-(--text-muted)">
                  {plural(preview.pinnedTabs, 'Pinned Tab')} and {plural(preview.folders, 'Folder')}{' '}
                  in this space.
                </p>
              )}
            </div>
          )}
        </li>
        <li>
          Click <strong>Import</strong>. Sidearc shows how many Favorites, Pinned Tabs and Folders
          it imported.
          <div className="mt-2">
            <button
              type="button"
              disabled={!spaceId}
              onClick={startImport}
              className={optionsButton}
            >
              Import
            </button>
          </div>
          {report && <Report report={report} />}
        </li>
      </ol>
      <p className="mt-4 text-xs text-(--text-muted)">
        Imported: the Pinned Tabs and Folders of the space, with their nesting, and the Favorites of
        the matching Arc profile ({MAX_FAVORITES} at most).
      </p>
      <p className="mt-1 text-xs text-(--text-muted)">
        Not imported: Arc's Unpinned Tabs, Live Folders, notes and easels.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-(--g-red)">
          {error}
        </p>
      )}
      {itemCountToReplace !== undefined && (
        <ReplaceQuestion
          itemCount={itemCountToReplace}
          spaceTitle={spaces.find((space) => space.id === spaceId)?.title ?? ''}
          onConfirm={replaceItems}
          onCancel={() => setItemCountToReplace(undefined)}
        />
      )}
    </Section>
  );
}
