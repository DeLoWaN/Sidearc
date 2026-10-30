import { useAppearance } from '../ui/useAppearance';
import { AppearanceSection } from './sections/AppearanceSection';
import { ArchiveDelaySection } from './sections/ArchiveDelaySection';
import { ArcImportSection } from './sections/ArcImportSection';
import { BackupSection } from './sections/BackupSection';
import { SettingsProvider, useSettings } from './settings-context';

function OptionsPage() {
  useAppearance(useSettings().settings);
  return (
    <div className="panel-background min-h-screen">
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold">Sidearc options</h1>
        <ArchiveDelaySection />
        <AppearanceSection />
        <BackupSection />
        <ArcImportSection />
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
