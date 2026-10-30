import { FavoriteTile } from '../components/FavoriteTile';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';

/** The Favorites as a grid of large icons above the Pinned Tabs. It shows nothing without a Favorite. */
export function FavoritesSection() {
  const { windowId } = usePanel();
  const items = usePanelStore((store) => store.state.items);
  const favorites = items
    .filter((item) => item.kind === 'favorite')
    .sort((a, b) => a.position - b.position);
  if (favorites.length === 0) return null;

  return (
    <section aria-label="Favorites" className="mb-3.5">
      <ul aria-label="Favorites list" className="grid grid-cols-4 gap-2">
        {favorites.map((item) => (
          <FavoriteTile
            key={item.id}
            item={item}
            highlighted={Boolean(item.live?.active && item.live.windowId === windowId)}
          />
        ))}
      </ul>
    </section>
  );
}
