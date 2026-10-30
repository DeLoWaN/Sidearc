import type { SidebarState } from '../../src/shared/types';

/**
 * A complete sidebar state. A ticket that adds a required field to SidebarState adds its default
 * on a line of its own below, so older tests keep compiling.
 */
export function makeState(overrides: Partial<SidebarState> = {}): SidebarState {
  return {
    // tabs (#3)

    // items (#4, #5, #6)

    // tab groups (#9)

    // settings (#14)

    ...overrides,
  };
}
