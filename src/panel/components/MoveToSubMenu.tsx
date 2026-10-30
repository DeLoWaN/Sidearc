import type { CommandBody } from '../connection';
import type { MoveTarget } from '../move-target';
import { MenuItem, SubMenu } from './menu';

/**
 * The "Move to…" entry of a menu: a submenu with one entry for each target.
 * The entry holds no rule about what can move where: the caller gives the targets.
 * It is disabled when there is no target. A choice sends the command of the target.
 */
export function MoveToSubMenu({
  targets,
  onChoose,
}: {
  targets: MoveTarget[];
  onChoose: (command: CommandBody) => void;
}) {
  return (
    <SubMenu label="Move to…" disabled={targets.length === 0}>
      {targets.map(({ key, label, depth, command }) => (
        <MenuItem key={key} depth={depth} onSelect={() => onChoose(command)}>
          {label}
        </MenuItem>
      ))}
    </SubMenu>
  );
}
