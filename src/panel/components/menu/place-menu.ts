/** The space between a menu and the edge of the panel. */
const MARGIN = 6;

export type Box = { left: number; top: number; right: number; bottom: number };
export type Size = { width: number; height: number };

/**
 * Where a menu goes next to an anchor: a point (a box of size zero) or the entry of a parent menu.
 * The menu opens on the right of the anchor and below its top edge.
 * It flips to the left, or above, when there is no room, then stays inside the viewport.
 * `maxHeight` is the room that the viewport leaves: a taller menu has to scroll.
 */
export function placeMenu(anchor: Box, size: Size, viewport: Size) {
  const maxHeight = viewport.height - 2 * MARGIN;
  const height = Math.min(size.height, maxHeight);
  const left =
    anchor.right + size.width > viewport.width - MARGIN ? anchor.left - size.width : anchor.right;
  const top = anchor.top + height > viewport.height - MARGIN ? anchor.bottom - height : anchor.top;
  return {
    left: clamp(left, MARGIN, viewport.width - size.width - MARGIN),
    top: clamp(top, MARGIN, viewport.height - height - MARGIN),
    maxHeight,
  };
}

/** Keeps `value` between `min` and `max`. The minimum wins when there is no room. */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}
