import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { plural } from '../../shared/plural';

/** Replaces the drag image of a selection with a badge that counts the rows. */
export function showSelectionPreview(
  count: number,
  nativeSetDragImage: Parameters<typeof setCustomNativeDragPreview>[0]['nativeSetDragImage'],
) {
  setCustomNativeDragPreview({
    nativeSetDragImage,
    render: ({ container }) => {
      const badge = document.createElement('div');
      badge.textContent = plural(count, 'item');
      badge.className =
        'rounded-lg bg-(--menu-bg) px-3 py-1.5 font-semibold text-(--text) shadow-lg';
      container.append(badge);
    },
  });
}
