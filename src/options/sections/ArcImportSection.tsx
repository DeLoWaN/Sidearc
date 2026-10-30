import { useEffect, useState } from 'react';
import { type ArcImportReport, type ArcSpace, listArcSpaces } from '../../shared/arc-import';
import { MAX_FAVORITES } from '../../shared/item-tree';
import { plural } from '../../shared/plural';
import { optionsButton, optionsField } from '../button-style';
import { FilePickerButton } from '../FilePickerButton';
import { useAsk } from '../options-context';
import { Section } from '../Section';

const describeFailure = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure);

function Report({ report }: { report: ArcImportReport }) {
  return (
    <div role="status">
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

/**
 * The Arc import: pick `StorableSidebar.json`, pick one space, import.
 * It shows nothing once Sidearc has items, except the report of the import that just ran.
 */
export function ArcImportSection() {
  const ask = useAsk();
  const [available, setAvailable] = useState(false);
  const [text, setText] = useState<string>();
  const [spaces, setSpaces] = useState<ArcSpace[]>([]);
  const [spaceId, setSpaceId] = useState('');
  const [error, setError] = useState<string>();
  const [report, setReport] = useState<ArcImportReport>();

  useEffect(() => {
    ask('arc-import/available', null)
      .then(setAvailable)
      .catch((failure) =>
        setError(`Sidearc could not check the import: ${describeFailure(failure)}`),
      );
  }, [ask]);

  if (!available && !report && !error) return null;

  const chooseFile = async (file: File) => {
    setText(undefined);
    setSpaces([]);
    setSpaceId('');
    setError(undefined);
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

  const runImport = async () => {
    if (text === undefined) return;
    try {
      const result = await ask('arc-import/run', { text, spaceId });
      if (result.ok) {
        setReport(result.report);
        setError(undefined);
      } else {
        setError(result.error);
      }
    } catch (failure) {
      setError(`The import failed: ${describeFailure(failure)}`);
    }
  };

  return (
    <Section title="Import from Arc">
      {report ? (
        <Report report={report} />
      ) : (
        <div className="flex flex-col gap-3">
          <FilePickerButton
            buttonLabel="Choose file"
            inputLabel="Arc sidebar file"
            accept=".json,application/json"
            className={`self-start ${optionsButton}`}
            onFile={chooseFile}
          />
          <p className="text-xs opacity-70">
            Choose StorableSidebar.json, in the Arc folder of Application Support.
          </p>
          {spaces.length > 0 && (
            <label className="flex flex-col gap-1">
              Arc space
              <select
                value={spaceId}
                onChange={(event) => setSpaceId(event.target.value)}
                className={optionsField}
              >
                <option value="">Choose a space</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            disabled={!spaceId}
            onClick={runImport}
            className={`self-start ${optionsButton}`}
          >
            Import
          </button>
          {error && (
            <p role="alert" className="text-(--g-red)">
              {error}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
