/**
 * True when two addresses name the same page.
 * Chrome writes `https://x.com` as `https://x.com/`, so both forms must match.
 * The fragment counts: `#a` and `#b` are different addresses. An address that does not parse matches only itself.
 */
export function sameUrl(a: string, b: string): boolean {
  if (a === b) return true;
  if (!URL.canParse(a) || !URL.canParse(b)) return false;
  return new URL(a).href === new URL(b).href;
}
