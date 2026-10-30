import { usePanel } from '../panel-context';

/** The key that the `pin-current-tab` command of the manifest suggests. */
const PIN_SHORTCUT = 'Alt+Shift+P';

/** A card for an empty Sidesweep. Its button opens the options page, where the Arc import is. */
export function FirstRunCard() {
  const { send } = usePanel();
  return (
    <section
      aria-label="Getting started"
      className="mx-0.5 mb-2 flex flex-col items-start gap-2 rounded-xl bg-(--row-hover) p-3 text-xs"
    >
      <p>Your Pinned Tabs will show here.</p>
      <button
        type="button"
        onClick={() => send({ type: 'options/open' })}
        className="rounded-lg bg-(--menu-bg) px-3 py-1.5 font-medium shadow-sm hover:bg-(--menu-active)"
      >
        Import from Arc
      </button>
      <p className="text-(--text-muted)">Or press {PIN_SHORTCUT} to pin the current tab.</p>
    </section>
  );
}
