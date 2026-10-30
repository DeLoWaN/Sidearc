import { CloseIcon } from './CloseIcon';

/** The style of the small buttons at the right end of a row. */
export const rowButton =
  'mr-1 grid size-5 shrink-0 place-items-center rounded-md text-(--text-muted) hover:bg-(--row-hover) focus-visible:opacity-100';

/** The cross that deletes an item. It shows while the row (a `group`) is hovered, and while the cross has the focus. */
export function DeleteCross({ title, onDelete }: { title: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Delete ${title}`}
      onClick={onDelete}
      className={`${rowButton} mr-2 opacity-0 group-hover:opacity-100`}
    >
      <CloseIcon />
    </button>
  );
}
