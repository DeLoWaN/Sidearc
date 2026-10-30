/** The page icon when Chrome knows it, else the Chrome cache of site icons (permission `favicon`). */
export function iconUrl(pageUrl: string, pageIcon?: string): string {
  if (pageIcon) return pageIcon;
  const cache = new URL(browser.runtime.getURL('/_favicon/' as never));
  cache.searchParams.set('pageUrl', pageUrl);
  cache.searchParams.set('size', '32');
  return cache.toString();
}
