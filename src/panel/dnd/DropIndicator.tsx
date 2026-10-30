import type { Placement } from './use-dnd';

const line = 'pointer-events-none absolute bg-(--g-blue)';

/**
 * Shows where a drop lands, inside the element that is relative.
 * A line marks "above", "below", "before" and "after". A frame marks "inside".
 */
export function DropIndicator({ placement }: { placement: Placement }) {
  if (placement === 'inside') {
    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[10px] ring-2 ring-(--g-blue) ring-inset"
      />
    );
  }
  const position = {
    above: 'inset-x-2 -top-px h-0.5',
    below: 'inset-x-2 -bottom-px h-0.5',
    before: 'inset-y-1 -left-1.5 w-0.5',
    after: 'inset-y-1 -right-1.5 w-0.5',
  }[placement];
  return <span aria-hidden="true" className={`${line} ${position} rounded-full`} />;
}
