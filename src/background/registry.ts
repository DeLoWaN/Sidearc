import type { Command, CommandType, RpcMap, RpcName } from '../shared/protocol';

type CommandOf<T extends CommandType> = Extract<Command, { type: T }>;

const commandHandlers = new Map<string, (command: Command) => unknown>();
const rpcHandlers = new Map<
  string,
  (request: never, sender: chrome.runtime.MessageSender) => unknown
>();

/** Registers the one handler of a panel command. A second handler for the same type throws. */
export function registerCommand<T extends CommandType>(
  type: T,
  handler: (command: CommandOf<T>) => unknown,
) {
  if (commandHandlers.has(type)) throw new Error(`Command already registered: ${type}`);
  commandHandlers.set(type, handler as (command: Command) => unknown);
}

/** Registers the one handler of a one-off request. A second handler for the same name throws. */
export function registerRpc<K extends RpcName>(
  name: K,
  handler: (
    request: RpcMap[K]['request'],
    sender: chrome.runtime.MessageSender,
  ) => RpcMap[K]['response'] | Promise<RpcMap[K]['response']>,
) {
  if (rpcHandlers.has(name)) throw new Error(`RPC already registered: ${name}`);
  rpcHandlers.set(name, handler as never);
}

/** Runs the handler of a command. Throws when no module registered one. */
export async function dispatchCommand(command: Command) {
  const handler = commandHandlers.get(command.type);
  if (!handler) throw new Error(`Unknown command: ${command.type}`);
  await handler(command);
}

/** Adds the one runtime.onMessage listener of the worker. A second listener would race to answer. */
export function startRpcRouter() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler =
      message && typeof message === 'object' && 'rpc' in message
        ? rpcHandlers.get(String(message.rpc))
        : undefined;
    if (!handler) return false;
    const call = handler as (request: unknown, sender: chrome.runtime.MessageSender) => unknown;
    Promise.resolve(call(message.request, sender)).then(sendResponse);
    return true; // Keeps the channel open for the async answer.
  });
}

export function clearRegistries() {
  commandHandlers.clear();
  rpcHandlers.clear();
}
