import { AppearanceSection } from './sections/AppearanceSection';
import { ArchiveDelaySection } from './sections/ArchiveDelaySection';
import { ArcImportSection } from './sections/ArcImportSection';
import { BackupSection } from './sections/BackupSection';

export function OptionsApp() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Sidearc options</h1>
      <ArchiveDelaySection />
      <AppearanceSection />
      <BackupSection />
      <ArcImportSection />
    </main>
  );
}
