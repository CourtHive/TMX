/**
 * Commands over HTTP — realtime transport Phase 1
 * (Mentat/planning/REALTIME_TRANSPORT_PLUGGABILITY.md).
 *
 * With `serverConfig.commandsOverHttp`, an `executionQueue` goes to `POST /factory` and the HTTP
 * response becomes its ack. The socket keeps the subscriptions and server push. Everything around
 * the send stays in socketIo.ts: ack correlation, the offline queue, its order and its persistence.
 * Only the hop to the server changes.
 *
 * The server stamps identity on `POST /factory` exactly as on the socket (stampVerifiedIdentity),
 * and broadcasts the sender's `originClientId`. With no connection to exclude, the sender recognises
 * its own mutation that way (remoteMutations.ts).
 */
import { baseApi } from 'services/apis/baseApi';

// types
import type { ServerAck } from 'types/services';

/** The events that go over HTTP when the flag is on. */
export const HTTP_COMMANDS: ReadonlySet<string> = new Set(['executionQueue']);

/**
 * `ack` when the server answered, whether it accepted the command or refused it. `unreachable` when
 * nothing came back that could be an answer: no response at all, a gateway error, or a 401 the
 * silent refresh could not cure. That is the same as a socket message whose ack never arrives, and
 * it is handled the same way (the server-first timeout, the session guard, a durable re-queue).
 */
export type CommandOutcome = { ack: ServerAck } | { unreachable: string };

const GATEWAY_STATUSES = new Set([502, 503, 504]);

/** Map an HTTP answer to the socket ack shape. Exported for its tests. */
export function toCommandOutcome(ackId: string | undefined, response: any): CommandOutcome {
  if (!response) return { unreachable: 'no response' };
  const { status, data } = response;
  if (status === 401) return { unreachable: 'not authenticated' };
  if (GATEWAY_STATUSES.has(status)) return { unreachable: `gateway ${status}` };
  if (status >= 200 && status < 300 && data?.success) return { ack: { ackId, success: true } };

  // A refusal: the engine's (checkEngineError: { message, code, context, info }), the mutation
  // gate's (403: { message }), or a 2xx body that carries an error.
  const body = data?.error && typeof data.error === 'object' ? data.error : data;
  const message = (typeof body?.message === 'string' && body.message) || data?.error || `HTTP ${status}`;
  const ack: any = { ackId, error: { message: String(message), ...(body?.code && { code: body.code }) } };
  if (data?.context) ack.context = data.context;
  if (data?.info) ack.info = data.info;
  return { ack };
}

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
  if (heldBehind) return { unreachable: `held behind an earlier command that got no answer (${heldBehind})` };
  const payload = data?.payload ?? {};
  const response = await baseApi.post('/factory', payload, {
    // Refusals are answers, not transport errors: resolve them so they become the ack. A 401 still
    // rejects, so baseApi's interceptor gets its one silent refresh-and-retry.
    validateStatus: (status: number) => status !== 401,
    // mutationRequest reports the outcome; baseApi must not toast it as well.
    silenceErrors: true,
  });
  const outcome = toCommandOutcome(payload.ackId, response);
  if ('unreachable' in outcome) {
    heldBehind = outcome.unreachable;
    console.warn(`[socket] '${event}' over HTTP: ${outcome.unreachable}`);
  }
  return outcome;
}
