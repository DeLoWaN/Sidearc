import type { RpcMessage } from '../shared/protocol';

/** Events that give the page a user gesture, which sidePanel.open needs. */
const GESTURE_EVENTS = ['pointerdown', 'keydown'] as const;

/**
 * Closes the side panel while the page shows an element in fullscreen, and opens it again after.
 * Runs in the top frame, which also sees the fullscreen of a video in an embedded frame.
 */
export function startFullscreenGuard() {
  // True from the moment this page closes the side panel until it opens again.
  let panelHidden = false;

  const stopWaitingForGesture = () => {
    for (const type of GESTURE_EVENTS) document.removeEventListener(type, onGesture, true);
  };

  // Chrome refuses to open the panel without a gesture, for example after the Escape key.
  // The next click or key in the page brings one.
  const waitForGesture = () => {
    for (const type of GESTURE_EVENTS) document.addEventListener(type, onGesture, true);
  };

  function onGesture(event: Event) {
    if (!event.isTrusted) return;
    stopWaitingForGesture();
    showPanel();
  }

  // Sends the message at once, so that it carries the gesture of the current event.
  function showPanel() {
    const exit: RpcMessage<'fullscreen/exit'> = { rpc: 'fullscreen/exit', request: null };
    browser.runtime
      .sendMessage(exit)
      .then((opened) => {
        if (opened === true) panelHidden = false;
        else if (document.fullscreenElement === null) waitForGesture();
      })
      .catch(() => {});
  }

  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = document.fullscreenElement !== null;
    if (!isFullscreen) {
      if (panelHidden) showPanel();
      return;
    }
    stopWaitingForGesture();
    if (panelHidden) return;
    const enter: RpcMessage<'fullscreen/enter'> = { rpc: 'fullscreen/enter', request: null };
    browser.runtime
      .sendMessage(enter)
      .then((closed) => {
        if (closed !== true) return;
        panelHidden = true;
        // The page can leave fullscreen before the answer arrives.
        if (document.fullscreenElement === null) showPanel();
      })
      .catch(() => {});
  });
}
