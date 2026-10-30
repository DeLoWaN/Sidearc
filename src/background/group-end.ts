/**
 * Moves the tab to the place right after the last of the members in the tab strip of the window of the tab.
 * A member in another window, or one that is gone, does not count. Does nothing when no member sits in that window.
 * Throws when Chrome refuses the move.
 */
export async function moveAfterLastMember(tabId: number, memberIds: readonly number[]) {
  const tab = await browser.tabs.get(tabId);
  const members = await Promise.all(
    memberIds.filter((id) => id !== tabId).map((id) => browser.tabs.get(id).catch(() => undefined)),
  );
  const indexes = members.flatMap((member) =>
    member?.windowId === tab.windowId ? [member.index] : [],
  );
  if (indexes.length === 0) return;
  const last = Math.max(...indexes);
  // The index is the place after the move: a tab that leaves a place before the last member shifts it down by one.
  const target = tab.index > last ? last + 1 : last;
  if (target !== tab.index) await browser.tabs.move(tabId, { index: target });
}
