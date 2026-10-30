import { useRef } from 'react';
import type { TabGroupView, TabView } from '../../shared/types';
import { tabGroupTarget } from '../dnd/locators';
import { useDnd } from '../dnd/use-dnd';
import { usePanel } from '../panel-context';
import { GroupBlock } from './GroupBlock';

/** A Tab group: a header with a dot in the colour of the group and the title that Chrome gives it, and the member tabs. */
export function TabGroupBlock({ group, tabs }: { group: TabGroupView; tabs: TabView[] }) {
  const { send } = usePanel();
  const block = useRef<HTMLDivElement>(null);
  const { placement } = useDnd(block, { locate: tabGroupTarget(group.id) });
  return (
    <GroupBlock
      ref={block}
      group={{ kind: 'tab', groupId: group.id }}
      groupKey={`group-${group.id}`}
      name={group.title || 'Untitled group'}
      icon={
        <span
          aria-hidden="true"
          data-group-dot=""
          className="mx-0.5 block size-3 rounded-full bg-(--group-color)"
        />
      }
      tabs={tabs}
      collapsed={group.collapsed}
      onToggle={() => send({ type: 'group/toggle', groupId: group.id })}
      closeCommand={{ type: 'group/close', groupId: group.id }}
      color={group.color}
      dropPlacement={placement}
    />
  );
}
