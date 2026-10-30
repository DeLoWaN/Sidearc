import { createContext, useContext } from 'react';
import type { RpcMap, RpcMessage, RpcName } from '../shared/protocol';

/** Sends one request to the worker and waits for its answer. Components never touch chrome.*. */
export type Ask = <K extends RpcName>(
  rpc: K,
  request: RpcMap[K]['request'],
) => Promise<RpcMap[K]['response']>;

/** The `Ask` of the real options page: a runtime message to the worker. */
export const askWorker: Ask = (rpc, request) => {
  const message: RpcMessage<typeof rpc> = { rpc, request };
  return browser.runtime.sendMessage(message);
};

export const OptionsContext = createContext<Ask | undefined>(undefined);

export function useAsk(): Ask {
  const ask = useContext(OptionsContext);
  if (!ask) throw new Error('useAsk needs an OptionsContext above it');
  return ask;
}
