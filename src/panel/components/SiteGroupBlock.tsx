import type { SiteGroupView, TabView } from '../../shared/types';
import { usePanel } from '../panel-context';
import { usePanelUi } from '../ui-store';
import { GroupBlock } from './GroupBlock';
import { MenuItem } from './menu';
import { SiteIcon } from './SiteIcon';
import { TitleField } from './TitleField';

/** A site group: a header with the site icon and the name of the group, and the member tabs. Only the panel shows it. */
export function SiteGroupBlock({ group, tabs }: { group: SiteGroupView; tabs: TabView[] }) {
  const { send } = usePanel();
  const renaming = usePanelUi((ui) => ui.renamingGroupId === group.id);
  const startRename = usePanelUi((ui) => ui.startRenameGroup);
  const stopRename = usePanelUi((ui) => ui.stopRenameGroup);
  const name = group.name ?? group.host;

  return (
    <GroupBlock
      site
      name={name}
      icon={<SiteIcon iconUrl={tabs[0]?.iconUrl ?? ''} title={name} />}
      tabs={tabs}
      collapsed={group.collapsed}
      onToggle={() => send({ type: 'site-group/toggle', groupId: group.id })}
      closeCommand={{ type: 'site-group/close', groupId: group.id }}
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
      menuItems={
        <>
          <MenuItem onSelect={() => startRename(group.id)}>Rename group</MenuItem>
          <MenuItem onSelect={() => send({ type: 'site-group/ungroup', groupId: group.id })}>
            Ungroup
          </MenuItem>
        </>
      }
    />
  );
}
