import { useAppearance } from '../ui/useAppearance';
import { FavoritesSection } from './sections/FavoritesSection';
import { FooterBar } from './sections/FooterBar';
import { Overlays } from './sections/Overlays';
import { PinnedSection } from './sections/PinnedSection';
import { SearchStatus } from './sections/SearchStatus';
import { UnpinnedSection } from './sections/UnpinnedSection';
import { usePanelStore } from './store';

export function App() {
  useAppearance(usePanelStore((store) => store.state.settings));
  return (
    <div className="panel-background flex h-screen flex-col">
      <main aria-label="Sidearc" className="min-h-0 flex-1 overflow-y-auto p-2.5">
        <FavoritesSection />
        <PinnedSection />
        <UnpinnedSection />
        <SearchStatus />
      </main>
      <FooterBar />
      <Overlays />
    </div>
  );
}
