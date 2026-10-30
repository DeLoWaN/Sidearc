import type { LinkGuardPush, RpcMessage } from '../shared/protocol';
import { opensOtherHost } from './link-rule';

/** Link targets that load the page in the tab of the link. */
const OWN_TARGETS = new Set(['', '_self', '_parent', '_top']);

function findLink(event: MouseEvent) {
  // The path crosses shadow roots, which `event.target` does not.
  return event.composedPath().find((node) => node instanceof HTMLAnchorElement);
}

/** True for a plain left click that Chrome would load in this tab. */
function isPlainClick(event: MouseEvent) {
  const hasModifier = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
  // A click that a script makes (`a.click()`) is a script navigation: it stays in the tab.
  return event.isTrusted && event.button === 0 && !hasModifier && !event.defaultPrevented;
}

/**
 * Sends a click on a link to another host to a new Unpinned Tab, but only while this tab is a live tab.
 * Runs in the top frame. The worker pushes a message each time the live status of the tab changes.
 */
export function startLinkGuard() {
  // The worker injects the script again after each new grant: a second copy would open each link twice.
  const page = globalThis as { sidesweepLinkGuard?: true };
  if (page.sidesweepLinkGuard) return;
  page.sidesweepLinkGuard = true;

  let live = false;
  let pushed = false;

  browser.runtime.onMessage.addListener((message: Partial<LinkGuardPush>) => {
    if (message?.type !== 'link-guard/live') return;
    live = message.live === true;
    pushed = true;
  });

  // A push that arrives first is newer than this answer.
  const ask: RpcMessage<'link-guard/is-live'> = { rpc: 'link-guard/is-live', request: null };
  browser.runtime
    .sendMessage(ask)
    .then((answer) => {
      if (!pushed) live = answer === true;
    })
    .catch(() => {});

  // The capture phase sees the click before the page does.
  document.addEventListener(
    'click',
    (event) => {
      if (!live || !isPlainClick(event)) return;
      const link = findLink(event);
      if (!link || link.hasAttribute('download') || !OWN_TARGETS.has(link.target)) return;
      if (!opensOtherHost(location.href, link.href)) return;
      event.preventDefault();
      const open: RpcMessage<'link-guard/open'> = {
        rpc: 'link-guard/open',
        request: { url: link.href },
      };
      browser.runtime.sendMessage(open).catch(console.error);
    },
    true,
  );
}
