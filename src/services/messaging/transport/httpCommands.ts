/**
 * Commands over HTTP — realtime transport Phase 1
 * (Mentat/planning/REALTIME_TRANSPORT_PLUGGABILITY.md).
 *
 * With `serverConfig.commandsOverHttp`, a command goes over HTTP instead of the socket:
 * - an `executionQueue` goes to `POST /factory`;
 * - a `chatMessage` goes to `POST /tmx/chat`.
 *
 * The HTTP answer is turned into the event the server would have emitted back on the socket
 * (`ack`, `chatAccepted`, `chatRejected`), and socketIo.ts hands it to the same handler. The socket
 * keeps the subscriptions and server push. Everything around the send stays in socketIo.ts: ack
 * correlation, the offline queue, its order and its persistence. Only the hop to the server changes.
 *
 * The server stamps identity on these routes exactly as on the socket, and broadcasts the sender's
 * `originClientId` / `clientMsgId`. With no connection to exclude, the sender recognises its own
 * mutation (remoteMutations.ts) and its own chat message (chatService.ts) that way.
 */
import { baseApi } from 'services/apis/baseApi';

/** An event as the socket would have delivered it to this tab. */
export interface Delivery {
  event: string;
  payload: any;
}

/**
 * `deliver` when the server answered, whether it accepted the command or refused it. `unreachable`
 * when nothing came back that could be an answer: no response at all, a gateway error, or a 401
 * the silent refresh could not cure. For a mutation that is the same as a socket message whose ack
 * never arrives, and it is handled the same way (the server-first timeout, the session guard, a
 * durable re-queue). A chat message also delivers its own failure, so it does not sit at "sending".
 */
export type CommandOutcome = { deliver: Delivery } | { unreachable: string; deliver?: Delivery };

interface Route {
  path: string;
  body: (data: any) => any;
  answer: (data: any, response: any) => CommandOutcome;
}

const GATEWAY_STATUSES = new Set([502, 503, 504]);

/** Why a response is not an answer at all, or undefined when it is one. */
function unreachableReason(response: any): string | undefined {
  if (!response) return 'no response';
  if (response.status === 401) return 'not authenticated';
  if (GATEWAY_STATUSES.has(response.status)) return `gateway ${response.status}`;
  return undefined;
}

/** Map a `POST /factory` answer to the socket's `ack`. Exported for its tests. */
export function toCommandOutcome(ackId: string | undefined, response: any): CommandOutcome {
  const unreachable = unreachableReason(response);
  if (unreachable) return { unreachable };
  const { status, data } = response;
  if (status >= 200 && status < 300 && data?.success)
    return { deliver: { event: 'ack', payload: { ackId, success: true } } };

  // A refusal: the engine's (checkEngineError: { message, code, context, info }), the mutation
  // gate's (403: { message }), or a 2xx body that carries an error.
  const body = data?.error && typeof data.error === 'object' ? data.error : data;
  const message = (typeof body?.message === 'string' && body.message) || data?.error || `HTTP ${status}`;
  const ack: any = { ackId, error: { message: String(message), ...(body?.code && { code: body.code }) } };
  if (data?.context) ack.context = data.context;
  if (data?.info) ack.info = data.info;
  return { deliver: { event: 'ack', payload: ack } };
}

/** Map a `POST /tmx/chat` answer to the socket's `chatAccepted` / `chatRejected`. Exported for its tests. */
export function toChatOutcome(clientMsgId: string | undefined, response: any): CommandOutcome {
  const unreachable = unreachableReason(response);
  if (unreachable) {
    return { unreachable, deliver: { event: 'chatRejected', payload: { clientMsgId, error: unreachable } } };
  }
  const data = response.data;
  if (data?.accepted) return { deliver: { event: 'chatAccepted', payload: data.accepted } };
  if (data?.rejected) return { deliver: { event: 'chatRejected', payload: data.rejected } };
  if (data?.ignored) return { deliver: { event: 'chatRejected', payload: { clientMsgId, error: 'ignored' } } };
  return { deliver: { event: 'chatRejected', payload: { clientMsgId, error: `HTTP ${response.status}` } } };
}

const ROUTES: Record<string, Route> = {
  executionQueue: {
    path: '/factory',
    body: (data) => data?.payload ?? {},
    answer: (data, response) => toCommandOutcome(data?.payload?.ackId, response),
  },
  chatMessage: {
    path: '/tmx/chat',
    body: (data) => data,
    answer: (data, response) => toChatOutcome(data?.clientMsgId, response),
  },
};

/** The events that go over HTTP when the flag is on. */
export const HTTP_COMMANDS: ReadonlySet<string> = new Set(Object.keys(ROUTES));

/**
 * Commands from this tab go one at a time, so the server receives them in the order they were sent,
 * as it does over the one socket. Once a command gets no answer, the ones behind it are not sent
 * either until the connection is re-established (`resumeCommands`). Otherwise a later command could
 * apply before the one it was written after.
 */
let chain: Promise<unknown> = Promise.resolve();
let heldBehind: string | undefined;

/** Called on every (re)connect: the server is reachable again. */
export function resumeCommands(): void {
  heldBehind = undefined;
}

export function postCommand(event: string, data: any): Promise<CommandOutcome> {
  const run = chain.then(() => send(event, data));
  chain = run.catch(() => undefined);
  return run;
}

async function send(event: string, data: any): Promise<CommandOutcome> {
  const route = ROUTES[event];
  if (heldBehind) {
    // Not sent, so it gets what an unanswered command gets, including a chat message's failure.
    const { deliver } = route.answer(data, undefined);
    return { unreachable: `held behind an earlier command (${heldBehind})`, ...(deliver && { deliver }) };
  }
  const response = await baseApi.post(route.path, route.body(data), {
    // Refusals are answers, not transport errors: resolve them so they become the reply. A 401
    // still rejects, so baseApi's interceptor gets its one silent refresh-and-retry.
    validateStatus: (status: number) => status !== 401,
    // The caller reports the outcome; baseApi must not toast it as well.
    silenceErrors: true,
  });
  const outcome = route.answer(data, response);
  if ('unreachable' in outcome) {
    heldBehind = outcome.unreachable;
    console.warn(`[socket] '${event}' over HTTP: ${outcome.unreachable}`);
  }
  return outcome;
}
