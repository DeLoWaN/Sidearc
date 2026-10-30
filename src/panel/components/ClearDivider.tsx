import { usePanel } from '../panel-context';

/** The line above the Unpinned Tabs, with the button that closes all of them. */
export function ClearDivider({ disabled }: { disabled: boolean }) {
  const { send } = usePanel();
  return (
    <div className="mx-1 my-2.5 flex items-center gap-2 text-[11px] text-(--text-muted)">
      <span aria-hidden="true" className="h-px flex-1 bg-current opacity-20" />
      <button
        type="button"
        disabled={disabled}
        onClick={() => send({ type: 'tab/clear' })}
        className="rounded-md px-1.5 py-0.5 hover:bg-(--row-hover) disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <span aria-hidden="true">↓ </span>Clear
      </button>
    </div>
  );
}
