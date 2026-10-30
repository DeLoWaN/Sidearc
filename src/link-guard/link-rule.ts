const WEB_PROTOCOLS = new Set(['http:', 'https:']);

/** Parses an address, resolved against the page when it is relative. Returns null when it is not valid. */
function parse(address: string, base?: string): URL | null {
  try {
    return new URL(address, base);
  } catch {
    return null;
  }
}

/**
 * True when the link is a web link to another host than the page.
 * Hosts are the same only when equal, so a subdomain or `www.` is another host.
 * A relative link resolves against the page. A link that is not http or https is never another host.
 */
export function opensOtherHost(pageUrl: string, href: string): boolean {
  const page = parse(pageUrl);
  const link = parse(href, pageUrl);
  if (!page || !link) return false;
  if (!WEB_PROTOCOLS.has(page.protocol) || !WEB_PROTOCOLS.has(link.protocol)) return false;
  // `URL.host` keeps the port, so the same name on another port is another host.
  return page.host !== link.host;
}
