/** A button with its own border and fill: the cards of the options page are almost white, so a flat button would not look like one. */
export const optionsButton =
  'rounded-lg border border-(--text-muted)/50 bg-(--menu-bg) px-3 py-1.5 font-medium shadow-sm hover:border-(--text) hover:bg-(--menu-active) focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:hover:border-(--text-muted)/50 disabled:hover:bg-(--menu-bg)';

/** A text, number or select field with a visible border, for the same reason as the buttons. */
export const optionsField =
  'rounded-lg border border-(--text-muted)/50 bg-(--menu-bg) px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2';
