import { createContext, useContext } from 'react';
import type { Connection } from './connection';

/** The window of the panel and the way to send it commands. Components never touch chrome.*. */
export const PanelContext = createContext<Connection | undefined>(undefined);

export function usePanel(): Connection {
  const connection = useContext(PanelContext);
  if (!connection) throw new Error('usePanel needs a PanelContext above it');
  return connection;
}
