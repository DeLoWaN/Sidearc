import { registerCommand } from '../registry';
import type { WorkerModule } from '../worker-module';
import { shownSiteGroup } from './site-groups';

const moveGroup: WorkerModule = {
  name: 'move-group',
  order: 30,
  start() {
    // Neither command is in the Undo list of undo.ts: Undo does not revert a move of tabs.
    registerCommand('group/move', async ({ groupId, index, targetWindowId }) => {
      const group = await browser.tabGroups.get(groupId).catch(() => undefined);
      if (group) await browser.tabGroups.move(groupId, { index, windowId: targetWindowId });
    });

    registerCommand('site-group/move', async ({ groupId, index, targetWindowId }) => {
      const shown = await shownSiteGroup(groupId);
      // One call keeps the members next to each other, in the order that they had.
      if (shown) await browser.tabs.move(shown.group.tabIds, { index, windowId: targetWindowId });
    });
  },
};
export default moveGroup;
