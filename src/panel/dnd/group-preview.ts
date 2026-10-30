import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';

/** Replaces the drag image of a group with a copy of its whole block, held where the pointer grabbed the header. */
export function showBlockPreview(
  block: HTMLElement,
  pointer: { clientX: number; clientY: number },
  nativeSetDragImage: Parameters<typeof setCustomNativeDragPreview>[0]['nativeSetDragImage'],
) {
  const box = block.getBoundingClientRect();
  setCustomNativeDragPreview({
    nativeSetDragImage,
    getOffset: () => ({ x: pointer.clientX - box.left, y: pointer.clientY - box.top }),
    render: ({ container }) => {
      const frame = document.createElement('div');
      frame.className = 'rounded-xl bg-(--menu-bg) shadow-lg';
      frame.style.width = `${box.width}px`;
      frame.append(block.cloneNode(true));
      container.append(frame);
    },
  });
}
