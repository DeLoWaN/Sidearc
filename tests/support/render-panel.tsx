import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { PanelContext } from '../../src/panel/panel-context';
import { usePanelStore } from '../../src/panel/store';
import type { SidebarState } from '../../src/shared/types';
import { makeState } from './builders';

/**
 * Renders a panel component with a sidebar state and a fake command sender.
 * Returns the sender, so a test can check which command a user action sends.
 */
export function renderPanel(
  ui: ReactElement,
  { windowId = 1, state = makeState() }: { windowId?: number; state?: SidebarState } = {},
) {
  const send = vi.fn();
  usePanelStore.getState().receive(state);
  render(<PanelContext value={{ windowId, send }}>{ui}</PanelContext>);
  return { send };
}
