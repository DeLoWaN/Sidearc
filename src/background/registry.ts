import type { Command, CommandType, RpcMap, RpcName } from '../shared/protocol';

type CommandOf<T extends CommandType> = Extract<Command, { type: T }>;

const commandHandlers = new Map<string, (command: Command) => unknown>();
/** Runs around every command. It decides when to call `run`, which runs the handler. */
type CommandWrapper = (command: Command, run: () => Promise<void>) => Promise<void>;

let commandWrapper: CommandWrapper | undefined;
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

/** Sets the one wrapper that runs around every command. A second wrapper throws. */
export function wrapCommands(wrapper: CommandWrapper) {
  if (commandWrapper) throw new Error('Command wrapper already set');
  commandWrapper = wrapper;
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

/** Runs the handler of a command, inside the command wrapper if one is set. Throws when no module registered a handler. */
export async function dispatchCommand(command: Command) {
  const handler = commandHandlers.get(command.type);
  if (!handler) throw new Error(`Unknown command: ${command.type}`);
  const run = async () => {
    await handler(command);
  };
  await (commandWrapper ? commandWrapper(command, run) : run());
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

/** Forgets every handler. Handlers are module state and survive between tests. */
export function clearRegistries() {
  commandHandlers.clear();
  commandWrapper = undefined;
  rpcHandlers.clear();
}
