// Windows where Sidesweep waits for the answer of `tabs.create`, with the number of waits.
const creating = new Map<number, number>();

/**
 * Creates a tab for Sidesweep itself in a window.
 * Chrome fires `tabs.onCreated` before `tabs.create` answers, so the window is marked until the answer comes.
 */
export async function createTabBySidesweep(
  properties: chrome.tabs.CreateProperties & { windowId: number },
): Promise<chrome.tabs.Tab> {
  creating.set(properties.windowId, (creating.get(properties.windowId) ?? 0) + 1);
  try {
    return await browser.tabs.create(properties);
  } finally {
    const left = (creating.get(properties.windowId) ?? 1) - 1;
    if (left > 0) creating.set(properties.windowId, left);
    else creating.delete(properties.windowId);
  }
}

/** True while Sidesweep creates a tab in this window. A tab that Chrome reports now may be that tab. */
export const isCreatingTabBySidesweep = (windowId: number) => creating.has(windowId);
