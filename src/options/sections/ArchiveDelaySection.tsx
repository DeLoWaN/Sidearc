import { useEffect, useState } from 'react';
import { MAX_ARCHIVE_HOURS, MIN_ARCHIVE_HOURS } from '../../shared/settings';
import { Section } from '../Section';
import { useSettings } from '../settings-context';

/** The Auto Archive delay. The field saves on Enter and on leave, so a half-typed number never applies. */
export function ArchiveDelaySection() {
  const { settings, save } = useSettings();
  const [draft, setDraft] = useState(String(settings.autoArchiveHours));
  const [error, setError] = useState<string>();

  // The settings change under the field when a backup is imported.
  useEffect(() => setDraft(String(settings.autoArchiveHours)), [settings.autoArchiveHours]);

  const commit = async () => {
    if (draft === String(settings.autoArchiveHours)) return;
    const result = await save({ autoArchiveHours: Number(draft) });
    setError(result.ok ? undefined : result.error);
  };

  return (
    <Section title="Auto Archive">
      <label className="flex items-center gap-2">
        Close an Unpinned Tab after
        <input
          type="number"
          aria-label="Auto Archive delay in hours"
          min={MIN_ARCHIVE_HOURS}
          max={MAX_ARCHIVE_HOURS}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(undefined);
          }}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
          className="w-20 rounded-md bg-(--menu-bg) px-2 py-1"
        />
        hours without a visit
      </label>
      {error && (
        <p role="alert" className="mt-2 text-(--g-red)">
          {error}
        </p>
      )}
    </Section>
  );
}
