import { isFolderOrRoot, subtreeIds, topLevelIds } from '../../shared/item-tree';
import type { SelectionTarget } from '../../shared/protocol';
import type { ItemRecord } from '../../shared/types';
import { registerCommand } from '../registry';
import type { WorkerModule } from '../worker-module';
import { unpinItem } from './item-conversion';
import { deleteItems, getItems, moveItems } from './item-store';
import { getLiveTabs } from './live-tab-registry';
import { addTabsToSiteGroup } from './site-groups';
import { itemActions, pinTab } from './tab-actions';

/** The open Unpinned Tabs among the ids, in tab strip order. An unknown tab and a live tab of an item are left out. */
export async function selectedTabs(tabIds: number[]): Promise<chrome.tabs.Tab[]> {
  const [tabs, live] = await Promise.all([browser.tabs.query({}), getLiveTabs()]);
  const liveIds = new Set(live.values());
  const wanted = new Set(tabIds);
  return tabs
    .filter((tab) => wanted.has(tab.id as number) && !liveIds.has(tab.id as number))
    .sort((a, b) => a.windowId - b.windowId || a.index - b.index);
}

/** The Pinned Tabs and Folders that stand for the ids and their content, in the given order. */
export function selectedRoots(items: ItemRecord[], itemIds: string[]): string[] {
  const kindOf = new Map(items.map((item) => [item.id, item.kind]));
  return topLevelIds(
    items,
    itemIds.filter((id) => kindOf.has(id) && kindOf.get(id) !== 'favorite'),
  );
}

async function closeSelection(tabIds: number[], itemIds: string[]) {
  const [items, tabs] = await Promise.all([getItems(), selectedTabs(tabIds)]);
  await deleteItems(selectedRoots(items, itemIds));
  if (tabs.length > 0) await browser.tabs.remove(tabs.map((tab) => tab.id as number));
}

/** Puts the Pinned Tabs and Folders, then the Unpinned Tabs, in the Pinned Tabs. The tabs keep their live tab. */
async function moveToPinned(
  items: ItemRecord[],
  roots: string[],
  tabs: chrome.tabs.Tab[],
  target: Extract<SelectionTarget, { kind: 'pinned' }>,
) {
  const { parentId, index } = target;
  if (!isFolderOrRoot(items, parentId)) return;
  if (parentId !== null && roots.some((id) => subtreeIds(items, id).has(parentId))) return;
  await moveItems(roots, parentId, index);
  // The moved items fill the places from the index: the tabs follow them.
  const first = index === undefined ? undefined : index + roots.length;
  for (const [offset, tab] of tabs.entries()) {
    await pinTab(tab, {
      kind: 'pinned',
      parentId,
      ...(first === undefined ? {} : { index: first + offset }),
    });
  }
}

async function moveSelection(
  tabIds: number[],
  itemIds: string[],
  target: SelectionTarget,
  windowId: number,
) {
  const items = await getItems();
  const roots = selectedRoots(items, itemIds);
  const tabs = await selectedTabs(tabIds);
  const folderSelected = roots.some(
    (id) => items.find((item) => item.id === id)?.kind === 'folder',
  );
  switch (target.kind) {
    case 'pinned':
      return moveToPinned(items, roots, tabs, target);
    case 'unpinned':
      if (folderSelected) return;
      return itemActions.run(async () => {
        for (const id of roots) await unpinItem(id, windowId);
      });
    case 'tab-group': {
      const group = await browser.tabGroups.get(target.groupId).catch(() => undefined);
      const joining = tabs.filter((tab) => tab.groupId !== target.groupId);
      if (roots.length > 0 || !group || joining.length === 0) return;
      await browser.tabs.group({
        tabIds: joining.map((tab) => tab.id as number) as [number, ...number[]],
        groupId: target.groupId,
      });
      return;
    }
    case 'site-group':
      if (roots.length > 0) return;
      return addTabsToSiteGroup(
        target.groupId,
        tabs.map((tab) => tab.id as number),
      );
  }
}

const selection: WorkerModule = {
  name: 'selection',
  order: 32,
  start() {
    registerCommand('selection/close', ({ tabIds, itemIds }) => closeSelection(tabIds, itemIds));
    registerCommand('selection/move', ({ tabIds, itemIds, target, windowId }) =>
      moveSelection(tabIds, itemIds, target, windowId),
    );
  },
};
export default selection;
