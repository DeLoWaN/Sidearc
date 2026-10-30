import { useRef } from 'react';
import type { ItemView } from '../../shared/types';
import { FavoriteTile } from '../components/FavoriteTile';
import { DropIndicator } from '../dnd/DropIndicator';
import { usePanelDrag } from '../dnd/drag-store';
import { favoritesSectionTarget } from '../dnd/locators';
import { useDnd } from '../dnd/use-dnd';
import { usePanel } from '../panel-context';
import { usePanelStore } from '../store';
import { useSearchResults } from '../use-search-results';

/** The grid of Favorites. It is also the drop target of the section, away from any tile. */
function FavoritesGrid({ favorites }: { favorites: ItemView[] }) {
  const { windowId } = usePanel();
  const section = useRef<HTMLElement>(null);
  const { placement } = useDnd(section, { locate: favoritesSectionTarget });
  return (
    <section
      ref={section}
      aria-label="Favorites"
      data-drop={placement ?? undefined}
      className="relative mb-3.5"
    >
      {placement && <DropIndicator placement={placement} />}
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

/** Shows only while the user drags something, when no Favorite exists: it is the place to drop the first one. */
function FirstFavoriteZone() {
  const section = useRef<HTMLElement>(null);
  const { placement } = useDnd(section, { locate: favoritesSectionTarget });
  return (
    <section
      ref={section}
      aria-label="Favorites"
      data-drop={placement ?? undefined}
      className="relative mb-3.5 grid h-(--favorite-size) place-items-center rounded-xl border border-dashed border-(--text-muted) text-[11px] text-(--text-muted)"
    >
      Drop here to add a Favorite
      {placement && <DropIndicator placement={placement} />}
    </section>
  );
}

/**
 * The Favorites as a grid of large icons above the Pinned Tabs. It shows nothing without a Favorite.
 * A search keeps the matching ones.
 */
export function FavoritesSection() {
  const items = usePanelStore((store) => store.state.items);
  const results = useSearchResults();
  const dragging = usePanelDrag((drag) => drag.source !== null);
  const favorites =
    results?.favorites ??
    items.filter((item) => item.kind === 'favorite').sort((a, b) => a.position - b.position);
  if (favorites.length === 0) {
    const hasPlace = dragging && !results && items.every((item) => item.kind !== 'favorite');
    return hasPlace ? <FirstFavoriteZone /> : null;
  }
  return <FavoritesGrid favorites={favorites} />;
}
