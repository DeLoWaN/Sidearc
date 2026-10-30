import { useEffect, useState } from 'react';
import { useAppearance } from '../ui/useAppearance';
import { useAsk } from './options-context';
import { AppearanceSection } from './sections/AppearanceSection';
import { ArchiveDelaySection } from './sections/ArchiveDelaySection';
import { ArcImportSection } from './sections/ArcImportSection';
import { BackupSection } from './sections/BackupSection';
import { NewTabsSection } from './sections/NewTabsSection';
import { SiteGroupsSection } from './sections/SiteGroupsSection';
import { SettingsProvider, useSettings } from './settings-context';

/**
 * True when Sidearc had no item as the page opened: the Arc import then goes first.
 * Undefined until the worker answers. The answer stays the same for the whole visit,
 * so the import section never moves, and never loses its report, when an import fills Sidearc.
 */
function useStartedEmpty(): boolean | undefined {
  const ask = useAsk();
  const [startedEmpty, setStartedEmpty] = useState<boolean>();
  useEffect(() => {
    ask('arc-import/status', null).then(
      ({ itemCount }) => setStartedEmpty(itemCount === 0),
      () => setStartedEmpty(false),
    );
  }, [ask]);
  return startedEmpty;
}

function OptionsPage() {
  useAppearance(useSettings().settings);
  const startedEmpty = useStartedEmpty();
  return (
    <div className="panel-background min-h-screen">
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold">Sidearc options</h1>
        {startedEmpty === true && <ArcImportSection />}
        <ArchiveDelaySection />
        <SiteGroupsSection />
        <NewTabsSection />
        <AppearanceSection />
        <BackupSection />
        {startedEmpty === false && <ArcImportSection />}
      </main>
    </div>
  );
}

export function OptionsApp() {
  return (
    <SettingsProvider>
      <OptionsPage />
    </SettingsProvider>
  );
}
