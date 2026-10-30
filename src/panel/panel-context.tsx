import { createContext, useContext, useMemo } from 'react';
import type { Connection } from './connection';
import { usePanelSelection } from './selection-store';

/** The window of the panel and the way to send it commands. Components never touch chrome.*. */
export const PanelContext = createContext<Connection | undefined>(undefined);

/**
 * The connection of the panel. Any command that it sends ends the selection of rows.
 * The returned object stays the same while the connection stays the same.
 */
export function usePanel(): Connection {
  const connection = useContext(PanelContext);
  if (!connection) throw new Error('usePanel needs a PanelContext above it');
  return useMemo(
    () => ({
      windowId: connection.windowId,
      send(command) {
        connection.send(command);
        usePanelSelection.getState().clear();
      },
    }),
    [connection],
  );
}
