import type { MouseEvent, ReactNode, Ref } from 'react';
import type { TabView } from '../../shared/types';
import { DropIndicator } from '../dnd/DropIndicator';
import type { Placement } from '../dnd/use-dnd';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { TabRow } from './TabRow';

/**
 * The block of a group, for a Site group and for a Tab group.
 * The header is a row of the same height as a tab row. The member tabs sit one indent step below it.
 * A hover or a keyboard focus anywhere in the block tints the whole block.
 */
export function GroupBlock({
  name,
  icon,
  tabs,
  collapsed,
  onToggle,
  onContextMenu,
  editor,
  menu,
  ref,
  color,
  site = false,
  dropPlacement,
}: {
  /** The text on the header. It is also the accessible name of the block. */
  name: string;
  /** What leads the header: the site icon or a colour dot. */
  icon: ReactNode;
  tabs: TabView[];
  /** The saved state. A search shows the group open without changing it. */
  collapsed: boolean;
  onToggle: () => void;
  onContextMenu?: (event: MouseEvent) => void;
  /** A field that replaces the header while the user edits the name. */
  editor?: ReactNode;
  /** A menu to render beside the block. */
  menu?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  /** The Chrome colour name of a Tab group. The block gives it to its descendants as `--group-color`. */
  color?: string;
  site?: boolean;
  dropPlacement?: Placement | null;
}) {
  const { windowId } = usePanel();
  const searching = usePanelUi((ui) => ui.searching);
  const shut = collapsed && !searching;
  const hasUnvisited = shut && tabs.some((tab) => tab.unvisited);

  return (
    <li role="none">
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset is a form control, not a block. */}
      <div
        ref={ref}
        role="group"
        aria-label={name}
        data-site-group={site ? '' : undefined}
        data-color={color}
        data-drop={dropPlacement ?? undefined}
        className="relative my-0.5 rounded-[12px] pb-0.5 hover:bg-(--group-tint) has-[:focus-visible]:bg-(--group-tint)"
      >
        {dropPlacement && <DropIndicator placement={dropPlacement} />}
        {editor ? (
          <div className="flex h-(--row-height) items-center gap-2.5 px-2.5">
            {icon}
            {editor}
          </div>
        ) : (
          <button
            type="button"
            aria-label={name}
            aria-expanded={!shut}
            disabled={searching}
            onClick={onToggle}
            onContextMenu={onContextMenu}
            className="flex h-(--row-height) w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left font-semibold hover:bg-(--row-hover)"
          >
            <span className="relative shrink-0">
              {icon}
              {hasUnvisited && (
                <span
                  role="img"
                  aria-label="Not visited yet"
                  title="Not visited yet"
                  className="absolute -top-1 -left-1 size-2 rounded-full bg-(--unvisited)"
                />
              )}
            </span>
            <span className="truncate">{name}</span>
            <svg
              aria-hidden="true"
              data-chevron={shut ? 'right' : 'down'}
              viewBox="0 0 10 10"
              className={`size-2.5 shrink-0 text-(--text-muted) ${shut ? '-rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3.5 5 6.5 8 3.5" />
            </svg>
            {shut && <span className="font-normal text-(--text-muted)">{tabs.length}</span>}
          </button>
        )}
        {!shut && (
          <ul className="ml-6">
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
      {menu}
    </li>
  );
}
