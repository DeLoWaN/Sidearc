import { type MouseEvent, useState } from 'react';
import type { SiteGroupView, TabView } from '../../shared/types';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { GroupBlock } from './GroupBlock';
import { ContextMenu, MenuItem } from './menu';
import { SiteIcon } from './SiteIcon';
import { TitleField } from './TitleField';
import { focusableUnder } from './use-item-context-menu';

/** A site group: a header with the site icon and the name of the group, and the member tabs. Only the panel shows it. */
export function SiteGroupBlock({ group, tabs }: { group: SiteGroupView; tabs: TabView[] }) {
  const { send } = usePanel();
  const renaming = usePanelUi((ui) => ui.renamingGroupId === group.id);
  const startRename = usePanelUi((ui) => ui.startRenameGroup);
  const stopRename = usePanelUi((ui) => ui.stopRenameGroup);
  const [menu, setMenu] = useState<{ x: number; y: number; opener: HTMLElement | null }>();
  const name = group.name ?? group.host;

  const openMenu = (event: MouseEvent) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, opener: focusableUnder(event.target) });
  };

  return (
    <GroupBlock
      site
      name={name}
      icon={<SiteIcon iconUrl={tabs[0]?.iconUrl ?? ''} title={name} />}
      tabs={tabs}
      collapsed={group.collapsed}
      onToggle={() => send({ type: 'site-group/toggle', groupId: group.id })}
      onContextMenu={openMenu}
      editor={
        renaming && (
          <TitleField
            label={`Name of ${name}`}
            initial={name}
            allowEmpty
            onDone={(next) => {
              // An empty name asks the worker to remove the custom name.
              if (next !== undefined && (next || group.host) !== name)
                send({ type: 'site-group/rename', groupId: group.id, name: next });
              stopRename();
            }}
          />
        )
      }
      menu={
        menu && (
          <ContextMenu
            label={`Actions for ${name}`}
            x={menu.x}
            y={menu.y}
            returnFocusTo={menu.opener}
            onClose={() => setMenu(undefined)}
          >
            <MenuItem onSelect={() => startRename(group.id)}>Rename group</MenuItem>
            <MenuItem onSelect={() => send({ type: 'site-group/ungroup', groupId: group.id })}>
              Ungroup
            </MenuItem>
          </ContextMenu>
        )
      }
    />
  );
}
