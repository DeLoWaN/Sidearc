/** Puts `text` in the clipboard. A failure goes to the console: the menu has no place to show it. */
export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(console.error);
}
