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

/**
 * The site of a web address: its host in lower case, without a leading `www.`. Returns null for an address that is not http or https.
 * The port counts, as in `URL.host`. Another subdomain is another site.
 */
export function siteOf(address: string): string | null {
  if (!URL.canParse(address)) return null;
  const { protocol, host } = new URL(address);
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  return host.replace(/^www\./, '');
}

/** The forms of the address of a New Tab page that Chrome reports, with Google or another search engine as the default. */
const NEW_TAB_PAGE =
  /^(?:(?:chrome|edge):\/\/(?:newtab|new-tab-page(?:-third-party)?)|chrome-untrusted:\/\/new-tab-page|chrome-search:\/\/local-ntp)(?:[/?#]|$)/i;

/** True for the address of a Chrome New Tab page. A page that an extension puts in its place is not one. */
export const isNewTabPageUrl = (address: string) => NEW_TAB_PAGE.test(address);
