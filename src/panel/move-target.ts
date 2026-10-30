import type { CommandBody } from './connection';

/** One place that "Move to…" can send an item or a tab to. */
export interface MoveTarget {
  key: string;
  label: string;
  /** How deep the target sits in the tree. It indents the label. */
  depth?: number;
  /** The command that does the move. */
  command: CommandBody;
}
