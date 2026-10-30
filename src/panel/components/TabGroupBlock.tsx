import type { TabGroupView, TabView } from '../../shared/types';
import { usePanel } from '../panel-context';
import { TabRow } from './TabRow';

/** A Tab group: a coloured header that collapses or expands the group, and its tabs. */
export function TabGroupBlock({ group, tabs }: { group: TabGroupView; tabs: TabView[] }) {
  const { windowId, send } = usePanel();
  const title = group.title || 'Untitled group';
  return (
    <li role="none">
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset is a form control, not a block. */}
      <div
        role="group"
        aria-label={title}
        data-color={group.color}
        className="my-1 ml-1.5 rounded-[3px] border-l-[3px] border-(--group-color) pl-1"
      >
        <button
          type="button"
          aria-label={title}
          aria-expanded={!group.collapsed}
          onClick={() => send({ type: 'group/toggle', groupId: group.id })}
          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[11px] font-semibold text-(--group-color) hover:bg-(--row-hover)"
        >
          <span aria-hidden="true">{group.collapsed ? '▸' : '▾'}</span>
          <span className="truncate">{title}</span>
          {group.collapsed && <span className="font-normal">· {tabs.length}</span>}
        </button>
        {!group.collapsed && (
          <ul>
            {tabs.map((tab) => (
              <TabRow
                key={tab.id}
                tab={tab}
                highlighted={tab.active && tab.windowId === windowId}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
