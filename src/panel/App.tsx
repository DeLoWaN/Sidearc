import { FavoritesSection } from './sections/FavoritesSection';
import { FooterBar } from './sections/FooterBar';
import { Overlays } from './sections/Overlays';
import { PinnedSection } from './sections/PinnedSection';
import { UnpinnedSection } from './sections/UnpinnedSection';

export function App() {
  return (
    <>
      <main aria-label="Sidearc">
        <FavoritesSection />
        <PinnedSection />
        <UnpinnedSection />
      </main>
      <FooterBar />
      <Overlays />
    </>
  );
}
