import type { TreeNode } from '../build-tree';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { FolderRow } from './FolderRow';
import { NewFolderRow } from './NewFolderRow';
import { PinnedRow } from './PinnedRow';

/** One level of the tree: the Pinned Tabs and the Folders of one parent, each Folder with its own level. */
export function ItemList({
  nodes,
  parentId,
  label,
}: {
  nodes: TreeNode[];
  /** The Folder that holds this level, or null at the root. */
  parentId: string | null;
  label: string;
}) {
  const { windowId } = usePanel();
  const creatingIn = usePanelUi((ui) => ui.creatingIn);
  return (
    <ul aria-label={label}>
      {nodes.map((node) =>
        node.item.kind === 'folder' ? (
          <FolderRow key={node.item.id} item={node.item} nodes={node.children} />
        ) : (
          <PinnedRow
            key={node.item.id}
            item={node.item}
            highlighted={Boolean(node.item.live?.active && node.item.live.windowId === windowId)}
          />
        ),
      )}
      {creatingIn?.parentId === parentId && <NewFolderRow parentId={parentId} />}
    </ul>
  );
}
