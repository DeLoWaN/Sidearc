import { FavoritesSection } from './sections/FavoritesSection';
import { FooterBar } from './sections/FooterBar';
import { Overlays } from './sections/Overlays';
import { PinnedSection } from './sections/PinnedSection';
import { UnpinnedSection } from './sections/UnpinnedSection';

export function App() {
  return (
    <div className="panel-background flex h-screen flex-col">
      <main aria-label="Sidearc" className="min-h-0 flex-1 overflow-y-auto p-2.5">
        <FavoritesSection />
        <PinnedSection />
        <UnpinnedSection />
      </main>
      <FooterBar />
      <Overlays />
    </div>
  );
}
