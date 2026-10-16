/**
 * The TMX application protocol over the server connection: ack correlation,
 * tournament room membership, chat wiring, reconnect recovery.
 *
 * Realtime subscriptions and push use `MessageTransport`; commands are posted
 * directly over HTTP by httpCommands.ts. Socket.IO is the realtime implementation. The file
 * keeps its historical name so its importers did not have to change.
 */
import { HTTP_COMMANDS, postCommand, resumeCommands } from 'services/messaging/transport/httpCommands';
import { checkFactoryVersion, resetFactoryVersionCheck } from 'services/version/checkFactoryVersion';
import { createSocketIoTransport } from 'services/messaging/transport/socketIoTransport';
import { showOSNotification } from 'services/notifications/osNotification';
import { handleSocketException } from 'services/session/sessionGuard';
import { getOriginClientId } from 'services/messaging/clientIdentity';
import { getLoginState } from 'services/authentication/loginState';
import { getToken } from 'services/authentication/tokenManagement';
import { processDirective } from 'services/processDirective';
import { tmxToast } from 'services/notifications/tmxToast';
import { tools, version } from 'tods-competition-factory';
import { isFunction, isObject } from 'functions/typeOf';
import { version as tmxVersion } from 'config/version';
import { serverConfig } from 'config/serverConfig';
import { debugConfig } from 'config/debugConfig';
import { t } from 'i18n';
import {
  setChatSendFn,
  setChatGapFn,
  receiveMessage,
  receiveAccepted,
  receiveRejected,
  receiveHistory,
  setOnlineCount,
} from 'services/chat/chatService';
import {
  setAdminMonitorFns,
  receiveAdminChatFeed,
  receiveAdminChatHistory,
  rejoinChatMonitorIfActive,
} from 'services/chat/adminChatService';
import {
  persistMessage,
  forgetMessage,
  loadMessages,
  claimMessage,
  releaseMessage,
} from 'services/messaging/outboxStore';

// types
import type { MessageTransport, TransportStatus } from 'services/messaging/transport/messageTransport';
import type { Delivery } from 'services/messaging/transport/httpCommands';
import type { ServerAck } from 'types/services';

// constants
import {
  CLIENT_ERROR,
  SEND_KEY,
  TMX_DIRECTIVE,
  TMX_MESSAGE,
  JOIN_TOURNAMENT,
  LEAVE_TOURNAMENT,
} from 'constants/comsConstants';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

const oi: { timestampOffset: number; connection?: MessageTransport } = {
  timestampOffset: 0,
  connection: undefined,
};

/** True after a disconnect event until cleared by `clearDisconnectFlag()`. */
let disconnectedSinceLastNav = false;

/** Listeners invoked after the socket reconnects (not on the first connect).
 * Used by the staleness guard to check whether mutations were missed during the
 * offline window. Registered via `onSocketReconnect`. */
const reconnectListeners: Array<() => void> = [];

/** Register a callback to run after the socket reconnects following a drop.
 * Does not fire on the initial connection. */
export function onSocketReconnect(listener: () => void): void {
  reconnectListeners.push(listener);
}

const ackRequests: Record<string, (ack: ServerAck) => void> = {};
const ackTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

let mutationListener: ((data: any) => void) | null = null;
let currentTournamentRoom: string | undefined;

function tmxMessage(data: any): void {
  slog('[socket] tmxMessage:', { data });
}

/** Register a callback for remote tournament mutations broadcast by the server. */
export function onTournamentMutation(callback: ((data: any) => void) | null): void {
  mutationListener = callback;
}

let facilityScheduleListener: ((data: any) => void) | null = null;

/** Register a callback for opaque `facilityScheduleChanged` events — a linked facility peer's schedule
 * moved on the server. The event carries only `{ venueIds, changedAt }` (no tournament/matchUp detail);
 * the consumer re-fetches its reserved-cell projection, which re-gates server-side. */
export function onFacilityScheduleChanged(callback: ((data: any) => void) | null): void {
  facilityScheduleListener = callback;
}

function handleFacilityScheduleChanged(data: any): void {
  slog('[socket] received facilityScheduleChanged — venues:', data?.venueIds);
  facilityScheduleListener?.(data);
}

/** e2e/dev only: deliver a synthetic `facilityScheduleChanged` to the registered listener, to exercise
 * the client re-fetch path without a live linked-peer mutation on the server. */
export function simulateFacilityScheduleChanged(data: any): void {
  handleFacilityScheduleChanged(data);
}

function handleTournamentMutation(data: any): void {
  slog(
    '[socket] received tournamentMutation — methods:',
    data?.methods?.length,
    'tournaments:',
    data?.tournamentIds,
    'from:',
    data?.userId,
  );
  if (mutationListener) {
    mutationListener(data);
  } else {
    console.warn('[socket] tournamentMutation received but no listener registered');
  }
}

export function connectSocket(callback?: () => void): void {
  if (oi.connection) {
    slog('[socket] connectSocket called but transport already exists (connected=%s)', oi.connection.isConnected());
    return;
  }
  const socketPath = serverConfig.get().socketPath || process.env.SERVER || globalThis.location.origin;
  const url = `${socketPath}/tmx`;
  slog('[socket] connecting to', url);
  const transport = createSocketIoTransport({ url, getToken: () => getToken() ?? undefined });
  oi.connection = transport;

  transport.on(TMX_MESSAGE, tmxMessage);
  transport.on(TMX_DIRECTIVE, processDirective);
  transport.on('tournamentMutation', handleTournamentMutation);
  transport.on('facilityScheduleChanged', handleFacilityScheduleChanged);
  transport.on('chatMessage', receiveMessage);
  transport.on('chatAccepted', receiveAccepted);
  transport.on('chatRejected', receiveRejected);
  transport.on('chatHistory', receiveHistory);
  transport.on('roomPresence', setOnlineCount);
  transport.on('adminChatFeed', receiveAdminChatFeed);
  transport.on('adminChatHistory', receiveAdminChatHistory);
  transport.on('exception', handleException);
  transport.on('timestamp', (data: any) => (oi.timestampOffset = Date.now() - data.timestamp));

  setChatSendFn((data: any) => socketEmit('chatMessage', data));
  setChatGapFn((data: any) => socketEmit('chatSince', data));
  setAdminMonitorFns({
    join: () => socketEmit('joinChatMonitor', {}),
    leave: () => socketEmit('leaveChatMonitor', {}),
    reply: (data: any) => socketEmit('adminChatReply', data),
  });

  restorePersistedOutbox();

  // `callback` belongs to the FIRST connect only. It used to be passed to every `connect`,
  // reconnects included — and when emitTmx creates the connection lazily, the callback is the
  // action that emits a mutation, so that mutation was re-sent on every reconnect for the life
  // of the page.
  let pendingCallback = callback;
  transport.onStatus((status: TransportStatus, info?: any) => {
    if (status === 'connected') {
      const firstConnectCallback = pendingCallback;
      pendingCallback = undefined;
      connectionEvent(firstConnectCallback);
    } else if (status === 'disconnected') {
      slog('[socket] disconnected — reason:', info);
      disconnectedSinceLastNav = true;
      resetFactoryVersionCheck();
      showOSNotification({ title: 'TMX', body: 'Server connection lost' });
    } else {
      slog('[socket] connect_error:', info?.message ?? info);
      // DO NOT tear the connection down here.
      //
      // This handler used to call `disconnectSocket()`. In socket.io-client an
      // explicit `disconnect()` CANCELS automatic reconnection — the manager
      // will not retry after it — and `disconnectSocket` then deletes the
      // socket object outright. So a single transient `connect_error`
      // permanently disarmed reconnection, which is exactly what happens on a
      // back-forward-cache restore: the browser kills the transport while the
      // page is frozen, the first reconnect attempt errors, and the client then
      // sat dead for as long as the operator stayed on the page.
      //
      // A connect_error is transient by definition — socket.io is already
      // scheduling the next attempt. Auth rejections do NOT arrive here; the
      // server's SocketGuard emits `exception`, handled below.
      notifyConnectionTrouble();
    }
  });
}

function handleException(data: any): void {
  // The server's SocketGuard emits `exception` when it rejects a message —
  // most commonly for an expired/absent/wrong-audience token. Route those
  // to the session guard so the user gets a "log in again" banner and their
  // edit is preserved, instead of the message silently dying and surfacing
  // 10s later as a misleading "Server not responding". Non-auth exceptions
  // still surface here rather than being swallowed (A2).
  const handledAsAuth = handleSocketException(data);
  if (!handledAsAuth) console.warn('[socket] server exception:', data);
}

/**
 * A `connect_error` fires once per retry attempt, and socket.io retries every
 * second — so toasting per event produced a wall of identical danger toasts.
 * One toast per trouble window, re-armed by the next successful connect.
 */
let connectionTroubleNotified = false;

function notifyConnectionTrouble(): void {
  if (connectionTroubleNotified) return;
  connectionTroubleNotified = true;
  tmxToast({ message: t('toasts.connectionError'), intent: 'is-danger' });
}

/**
 * True only when there is a LIVE connection.
 *
 * Previously `!!oi.socket`, which is truthy for a socket object that exists and
 * is disconnected — so the settings panel displayed "Connected" on a dead socket.
 * Every caller wants live connectivity.
 */
export function connected(): boolean {
  return !!oi.connection?.isConnected();
}

/** True when a transport exists at all, connected or not (internal lifecycle checks). */
export function socketExists(): boolean {
  return !!oi.connection;
}

export function disconnectSocket(): void {
  slog('[socket] disconnectSocket called');
  oi.connection?.disconnect();
  setTimeout(() => delete oi.connection, 1000);
}

/**
 * Force a fresh handshake so the `auth` callback re-presents the current token.
 * Used after a silent refresh / re-login to shed a socket that is still holding
 * a stale (now-expired) token. Reconnecting fires `connectionEvent`, which — on
 * a post-drop reconnect — runs the registered reconnect listeners (the session
 * guard replays any preserved edits there).
 */
export function reconnectSocket(): void {
  if (oi.connection) {
    oi.connection.reconnect();
  } else {
    connectSocket();
  }
}

/**
 * Reconnect the socket if the user is logged in but the connection is down.
 * Returns true if a reconnect was initiated.
 *
 * ⚠️ Must reconnect the EXISTING transport when there is one. This used to call
 * `connectSocket()` unconditionally — but `connectSocket` early-returns when a
 * transport exists, so with a disconnected-but-not-deleted socket the whole
 * call was a silent no-op. That made the one caller (the router) unreliable too:
 * whether navigation recovered the connection depended on whether the socket
 * object happened to have been deleted yet.
 */
export function ensureConnected(): boolean {
  if (oi.connection?.isConnected()) return false;
  const state = getLoginState();
  if (!state) return false;

  if (oi.connection) {
    slog('[socket] ensureConnected — re-opening existing transport (disconnected)');
    // Re-arms a manager that an explicit disconnect had stopped.
    oi.connection.connect();
    return true;
  }

  slog('[socket] ensureConnected — no socket, connecting fresh');
  connectSocket();
  return true;
}

/** True if a disconnect occurred since the last call to `clearDisconnectFlag()`. */
export function hadDisconnect(): boolean {
  return disconnectedSinceLastNav;
}

export function clearDisconnectFlag(): void {
  disconnectedSinceLastNav = false;
}

/**
 * Returned by `emitTmx`. `cancel()` withdraws a message that has not left this tab yet — still
 * waiting for the first connect, or queued while offline — and reports whether it did. A message
 * already handed to the transport cannot be withdrawn, and `cancel()` returns false.
 */
export interface EmitHandle {
  cancel: () => boolean;
  /** Durable callers can wait until the command is safely stored before reporting completion. */
  persisted?: Promise<boolean>;
}

/**
 * `durable`: the caller has already acted on this message (a local-first mutation, a preserved
 * edit's replay). It is persisted before any send, with a stable command ID, and kept until a
 * server receipt confirms acceptance. Rejections remain available for reconciliation. See outboxStore.ts.
 */
export function emitTmx({
  data,
  ackCallback,
  durable,
}: {
  data: any;
  ackCallback?: (ack: ServerAck) => void;
  durable?: boolean;
}): EmitHandle {
  const state = getLoginState();
  const { email: userId } = state || {};
  const messageType = data.type ?? 'tmx';

  let ran = false;
  let cancelled = false;
  let withdraw: () => boolean = () => false;
  let persisted: Promise<boolean> | undefined;

  const action = () => {
    if (cancelled) return;
    ran = true;
    if (messageType === 'executionQueue') {
      data.payload.commandId ??= tools.UUID();
      data.payload.commandUser = userId;
    }
    if (ackCallback && isFunction(ackCallback)) {
      const ackId = data.payload?.ackId ?? tools.UUID();
      if (data.payload) Object.assign(data.payload, { ackId });

      requestAcknowledgement({
        ackId,
        callback: (ack) => {
          if ((ack as any).deduplicated && userId === getLoginState()?.email) {
            notifyDurableRecovery(data.payload.tournamentIds ?? []);
          }
          ackCallback(ack);
        },
      });
    }

    const timestamp = oi.timestampOffset ? Date.now() + oi.timestampOffset : Date.now();
    Object.assign(data.payload || data, {
      factoryVersion: version(),
      tmxVersion,
      timestamp,
      userId,
      // Echoed on the server's tournamentMutation broadcast; see clientIdentity.ts.
      originClientId: getOriginClientId(),
    });

    if (durable) {
      if (!userId || messageType !== 'executionQueue') {
        console.error('[socket] durable command requires a signed-in user and executionQueue');
        ackCallback?.({ error: { message: 'Durable command could not be stored for this session' } } as ServerAck);
        return;
      }
      data.payload.commandId ??= tools.UUID();
      data.payload.commandUser = userId;
      data.payload.ackId ??= tools.UUID();
    }
    const handle = socketEmit(messageType, data, durable ? userId : undefined);
    withdraw = handle.cancel;
    persisted = handle.persisted;
  };

  if (durable) {
    // Persist while a connection is still being established, not in its eventual callback.
    action();
    if (!oi.connection) connectSocket();
  } else if (oi.connection) {
    action();
  } else {
    connectSocket(action);
  }

  return {
    persisted,
    cancel: () => {
      if (ran) return withdraw();
      cancelled = true;
      return true;
    },
  };
}

/**
 * Messages are never sent while offline (CA, 2026-10-08, decision D1 in
 * Mentat/planning/REALTIME_TRANSPORT_PLUGGABILITY.md). A message that finds no
 * live connection is queued here and replayed, in order, once the connection is
 * back — after the tournament room and chat monitor are re-joined, so a replayed
 * message lands in the same state it was written against.
 *
 * Until then a disconnected send was dropped, with a log only behind the
 * `socketLog` debug flag: a local-first mutation made during an outage reached
 * neither the server nor any log.
 *
 * A durable message (see `emitTmx`) is also written to IndexedDB, and a reload
 * replays it once its user is connected again; everything else is in memory
 * only. A server-first mutation withdraws its entry when its own timeout fires
 * (see mutationRequest.ts). A dispatched request has an uncertain outcome until answered;
 * withdrawal only works while it remains queued.
 */
const MAX_OUTBOX = 500;
const leaseOwner = tools.UUID();
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleRecovery(): void {
  if (recoveryTimer) return;
  recoveryTimer = setTimeout(() => {
    recoveryTimer = undefined;
    if (oi.connection?.isConnected()) {
      durablePaused = false;
      resumeCommands();
      restorePersistedOutbox();
      startFlush();
    }
  }, 30_000);
  (recoveryTimer as any)?.unref?.();
}

/** Events `connectionEvent` rebuilds on every connect; a queued copy would only repeat it. */
const REBUILT_ON_CONNECT = new Set([
  'timestamp',
  'chatSince',
  'joinChatMonitor',
  'leaveChatMonitor',
  JOIN_TOURNAMENT,
  LEAVE_TOURNAMENT,
]);

interface DurableRecord {
  id: string;
  userId: string;
  queuedAt: number;
  /** Dispatch requires a successful IndexedDB write; failures stay pending in this page. */
  persisted: Promise<boolean>;
}

interface OutboxEntry {
  event: string;
  data: any;
  durable?: DurableRecord;
  dispatched?: boolean;
}

type DurableEntry = OutboxEntry & { durable: DurableRecord };

const outbox: OutboxEntry[] = [];
let lastQueuedAt = 0;
let flushing = false;
let durablePaused = false;

function persist(entry: DurableEntry): void {
  const { id, userId, queuedAt } = entry.durable;
  entry.durable.persisted = persistMessage({ id, userId, queuedAt, event: entry.event, data: entry.data }).then(
    () => true,
    (err) => {
      // The message still waits in memory; only a reload would lose it now (A2).
      console.error(`[socket] could not persist '${entry.event}' — not sent; keep this page open:`, err);
      tmxToast({ message: t('storage.writeFailed'), intent: 'is-danger' });
      return false;
    },
  );
}

function forget(entry: OutboxEntry | undefined): void {
  if (!entry?.durable) return;
  forgetMessage(entry.durable.id).catch((err) =>
    console.warn(`[socket] could not remove queued '${entry.event}' from IndexedDB:`, err),
  );
}

/**
 * Hand a message to the server; false when there is no live connection and the caller must queue
 * it. A command (`executionQueue`, `chatMessage`) always goes over HTTP (httpCommands.ts); the
 * server no longer accepts one on the socket, which carries subscriptions and server push only.
 * Online is still judged by the realtime connection, so the offline queue behaves as it always has.
 * A durable command the server never answered goes back to the head of the queue; any other is
 * left to its sender's timeout.
 */
function dispatch(event: string, data: any): boolean {
  if (!HTTP_COMMANDS.has(event)) return !!oi.connection?.send(event, data);
  if (!oi.connection?.isConnected()) return false;
  postCommand(event, data)
    .then((outcome) => {
      if (outcome.deliver) receiveOverHttp(outcome.deliver);
    })
    .catch((err) => console.warn(`[socket] '${event}' over HTTP failed:`, err));
  return true;
}

/** An HTTP answer, delivered to the handler the same event gets when it arrives on the socket. */
function receiveOverHttp({ event, payload }: Delivery): void {
  const handler: ((data: any) => void) | undefined = {
    ack: receiveAcknowledgement,
    chatAccepted: receiveAccepted,
    chatRejected: receiveRejected,
  }[event];
  if (handler) {
    handler(payload);
  } else {
    console.warn(`[socket] no handler for '${event}' answered over HTTP`);
  }
}

function enqueue(event: string, data: any, durableUserId?: string): OutboxEntry {
  const entry: OutboxEntry = { event, data: durableUserId ? structuredClone(data) : data };
  if (durableUserId) {
    entry.durable = {
      id: data.payload.commandId,
      userId: durableUserId,
      queuedAt: (lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1)),
      persisted: Promise.resolve(false),
    };
    persist(entry as DurableEntry);
  }
  outbox.push(entry);
  slog('[socket] offline — queued', event, `(${outbox.length} pending)`);
  if (outbox.length > MAX_OUTBOX) {
    // Applied local edits must never be sacrificed to an in-memory queue limit.
    const discardable = outbox.findIndex((item) => !item.durable);
    if (discardable >= 0) {
      const [dropped] = outbox.splice(discardable, 1);
      console.warn(`[socket] offline queue full (${MAX_OUTBOX}) — dropped oldest ephemeral '${dropped.event}'`);
    } else {
      console.warn(`[socket] durable backlog exceeds ${MAX_OUTBOX}; retaining pending commands`);
    }
  }
  return entry;
}

/**
 * Send now, or queue for the next connect. `durableUserId` marks a durable message and names its
 * user. Returns cancellation and, for durable messages, persistence completion.
 */
function socketEmit(event: string, data: any, durableUserId?: string): EmitHandle {
  // While a flush is replaying, a new message waits behind it so the server sees them in order.
  if (
    !durableUserId &&
    !durablePaused &&
    !((flushing || restoring) && !REBUILT_ON_CONNECT.has(event)) &&
    dispatch(event, data)
  ) {
    slog('[socket] emit:', event, data?.type ?? '');
    return { cancel: () => false };
  }
  if (REBUILT_ON_CONNECT.has(event)) {
    slog('[socket] offline — not queueing', event, '(rebuilt on connect)');
    return { cancel: () => false };
  }

  const entry = enqueue(event, data, durableUserId);
  if (durableUserId && oi.connection?.isConnected()) startFlush();
  return {
    persisted: entry.durable?.persisted,
    cancel: () => {
      if (entry.dispatched) return false;
      const index = outbox.indexOf(entry);
      if (index < 0) return false;
      outbox.splice(index, 1);
      forget(entry);
      return true;
    },
  };
}

const durableRecoveryListeners = new Set<(ids: string[]) => void>();
function notifyDurableRecovery(ids: string[]): void {
  for (const listener of durableRecoveryListeners) {
    try {
      listener(ids);
    } catch (error) {
      console.error('[socket] durable reconciliation listener failed:', error);
    }
  }
}
export function onDurableRecovery(listener: (ids: string[]) => void): () => void {
  durableRecoveryListeners.add(listener);
  return () => durableRecoveryListeners.delete(listener);
}

/** Never treat a failed persistence/claim as permission to send anyway. */
async function dispatchDurable(entry: DurableEntry): Promise<'done' | 'wait'> {
  if (entry.durable.userId !== getLoginState()?.email) return 'done'; // retained for its owner
  if (!(await entry.durable.persisted)) {
    persist(entry);
    scheduleRecovery();
    return 'wait';
  }
  const claim = await claimMessage(entry.durable.id, entry.durable.userId, leaseOwner);
  if (claim === 'busy') {
    scheduleRecovery();
    return 'wait';
  }
  if (claim === 'missing' || claim === 'blocked') return 'done';
  if (outbox[0] !== entry || entry.durable.userId !== getLoginState()?.email || !oi.connection?.isConnected()) {
    await releaseMessage(entry.durable.id, leaseOwner);
    return 'wait';
  }
  if (entry.data.payload?.commandId !== entry.durable.id) {
    await releaseMessage(entry.durable.id, leaseOwner, 'legacy-command');
    console.error('[socket] legacy durable command retained for reconciliation; retry safety is unknown');
    tmxToast({ message: t('toasts.durableChangeNeedsReview'), intent: 'is-danger' });
    return 'done';
  }
  const recovered = !ackRequests[entry.data.payload?.ackId];
  watchReplayedAck(entry);
  entry.dispatched = true;
  try {
    const outcome = await postCommand(entry.event, entry.data, () => entry.durable.userId === getLoginState()?.email);
    if ('unreachable' in outcome) {
      await releaseMessage(entry.durable.id, leaseOwner);
      scheduleRecovery();
      console.warn(`[socket] '${entry.event}' outcome uncertain — retained with the same command ID`);
      return 'wait';
    }
    const ack = outcome.deliver.payload;
    const accepted = ack?.success && ack.durableReceipt === true && ack.commandId === entry.durable.id;
    if (accepted) {
      await forgetMessage(entry.durable.id);
      if ((recovered || ack.deduplicated) && entry.durable.userId === getLoginState()?.email) {
        notifyDurableRecovery(entry.data.payload.tournamentIds ?? []);
      }
    } else {
      // Older servers cannot safely deduplicate a retry; terminal refusals also need reconciliation.
      await releaseMessage(entry.durable.id, leaseOwner, ack?.error ? 'rejected' : 'receipt-unsupported');
      console.error(
        `[socket] '${entry.event}' needs reconciliation:`,
        ack?.error ?? 'server did not confirm a durable receipt',
      );
      if (entry.durable.userId === getLoginState()?.email) {
        notifyDurableRecovery(entry.data.payload.tournamentIds ?? []);
        tmxToast({
          message: t(ack?.error ? 'toasts.offlineChangeRejected' : 'toasts.durableChangeNeedsReview'),
          intent: 'is-danger',
        });
      }
    }
    if (entry.durable.userId === getLoginState()?.email) receiveOverHttp(outcome.deliver);
    return 'done';
  } catch (error) {
    console.warn(`[socket] durable '${entry.event}' recovery failed; row retained:`, error);
    await releaseMessage(entry.durable.id, leaseOwner);
    scheduleRecovery();
    return 'wait';
  }
}

/**
 * A durable message can be replayed long after its sender's ack callback expired, or after a reload
 * dropped it. Its rejection must still be seen (A2).
 */
function watchReplayedAck(entry: OutboxEntry): void {
  const ackId = entry.data?.payload?.ackId;
  if (!ackId || ackRequests[ackId]) return;
  requestAcknowledgement({
    ackId,
    callback: (ack) => {
      if (!ack?.error) return;
      console.warn(`[socket] the server rejected '${entry.event}' queued while offline:`, ack.error);
    },
  });
}

/**
 * Replay queued messages in order. Whatever cannot be sent (the connection dropped again) stays
 * queued. Durable entries await persistence, acquire a temporary lease, then await their receipt.
 */
async function flushOutbox(): Promise<void> {
  if (flushing || !outbox.length) return;
  flushing = true;
  let replayed = 0;
  try {
    while (outbox.length) {
      const next = outbox[0];
      if (next.durable) {
        if ((await dispatchDurable(next as DurableEntry)) === 'wait') {
          durablePaused = true;
          break;
        }
      } else if (!dispatch(next.event, next.data)) break;
      // cancel() can withdraw a queued command while its persistence/claim is awaited.
      if (outbox[0] !== next) continue;
      outbox.shift();
      replayed += 1;
    }
  } finally {
    flushing = false;
  }
  if (replayed || outbox.length) {
    console.info(
      `[socket] replayed ${replayed} message(s) queued while offline` +
        (outbox.length ? `, ${outbox.length} still queued` : ''),
    );
  }
}

let restoring = false;

/** On connect/recovery: put the logged-in user's persisted messages from earlier pages at the head of the queue. */
function restorePersistedOutbox(): void {
  const userId = getLoginState()?.email;
  if (restoring || !userId) return;
  restoring = true;
  loadMessages(userId)
    .then((rows) => {
      if (userId !== getLoginState()?.email) return;
      const queued = new Set(outbox.map((entry) => entry.durable?.id));
      const restored: OutboxEntry[] = rows
        .filter((row) => !queued.has(row.id) && !row.blocked)
        .map(({ id, event, data, queuedAt }) => ({
          event,
          data,
          durable: { id, userId, queuedAt, persisted: Promise.resolve(true) },
        }));
      if (!restored.length) return;
      outbox.unshift(...restored);
      console.info(`[socket] restored ${restored.length} message(s) queued while offline before a reload`);
      if (oi.connection?.isConnected()) startFlush();
    })
    .catch((err) => {
      console.warn('[socket] could not read the offline queue from IndexedDB:', err);
      scheduleRecovery();
    })
    .finally(() => {
      restoring = false;
      if (oi.connection?.isConnected()) startFlush();
    });
}

function startFlush(): void {
  if (durablePaused || restoring) return;
  flushOutbox().catch((err) => {
    durablePaused = true;
    console.warn('[socket] offline queue replay failed; commands retained:', err);
    scheduleRecovery();
  });
}

/** e2e/dev only: how many messages are waiting for a connection. */
export function queuedMessageCount(): number {
  return outbox.length;
}

function connectionEvent(callback?: () => void): void {
  slog('[socket] connected — id:', oi.connection?.connectionId());
  // Re-arm the trouble toast so the NEXT outage is announced once more.
  connectionTroubleNotified = false;
  // Capture before anything clears the flag: true only when this `connect` is a
  // reconnect after a prior drop (the first connect leaves the flag false).
  const reconnected = disconnectedSinceLastNav;
  emitTmx({ data: { type: 'timestamp' } });

  // Re-join tournament room after reconnect (room membership is lost on disconnect)
  if (currentTournamentRoom) {
    slog('[socket] re-joining tournament room after reconnect:', currentTournamentRoom);
    socketEmit(JOIN_TOURNAMENT, { tournamentId: currentTournamentRoom });
  }

  // Re-join the super-admin chat monitor room after reconnect if it was open.
  rejoinChatMonitorIfActive();

  // Only now replay what was written while offline: the rooms it was written against are re-joined.
  restorePersistedOutbox();
  durablePaused = false;
  resumeCommands();
  startFlush();

  void checkFactoryVersion();

  // After a reconnect, notify listeners (staleness guard) so the client can
  // detect mutations broadcast while it was offline (Socket.IO has no replay).
  if (reconnected) {
    for (const listener of reconnectListeners) {
      try {
        listener();
      } catch (err) {
        slog('[socket] reconnect listener error:', err);
      }
    }
  }

  if (isFunction(callback)) callback();
}

const MAX_PENDING_ACKS = 100;

function requestAcknowledgement({
  ackId,
  uuid,
  callback,
}: {
  ackId?: string;
  uuid?: string;
  callback: (ack: ServerAck) => void;
}): void {
  // Prevent unbounded growth — purge oldest entries if limit reached
  const keys = Object.keys(ackRequests);
  if (keys.length >= MAX_PENDING_ACKS) {
    const toRemove = keys.slice(0, keys.length - MAX_PENDING_ACKS + 1);
    for (const key of toRemove) {
      clearTimeout(ackTimeouts[key]);
      delete ackRequests[key];
      delete ackTimeouts[key];
    }
    slog('[socket] purged', toRemove.length, 'stale ack requests');
  }

  const cleanup = () => {
    if (ackId) {
      delete ackRequests[ackId];
      delete ackTimeouts[ackId];
    }
    if (uuid) {
      delete ackRequests[uuid];
      delete ackTimeouts[uuid];
    }
  };

  const timeoutMs = (serverConfig.get().serverTimeout ?? 10000) * 3;
  const timerId = setTimeout(cleanup, timeoutMs);

  const wrappedCallback = (ack: any) => {
    cleanup();
    clearTimeout(timerId);
    try {
      callback(ack);
    } catch (err) {
      console.error('[socket] ack callback error:', err);
    }
  };

  if (ackId) {
    ackRequests[ackId] = wrappedCallback;
    ackTimeouts[ackId] = timerId;
  }
  if (uuid) {
    ackRequests[uuid] = wrappedCallback;
    ackTimeouts[uuid] = timerId;
  }
}

function receiveAcknowledgement(ack: ServerAck): void {
  // Receiving a server answer is not proof of local application. The operation owner advances
  // sync only after applying its canonical methods successfully.
  // Prefer ackId; fall back to uuid. Only fire once.
  const key = (ack.ackId && ackRequests[ack.ackId] && ack.ackId) || (ack.uuid && ackRequests[ack.uuid] && ack.uuid);
  if (key) ackRequests[key](ack);
}

/** Join a tournament room to receive mutation broadcasts from other clients. */
export function joinTournamentRoom(tournamentId: string): void {
  currentTournamentRoom = tournamentId;
  if (!tournamentId || !connected()) {
    slog('[socket] joinTournamentRoom skipped — tournamentId=%s, connected=%s', tournamentId, connected());
    return;
  }
  slog('[socket] joining room:', tournamentId);
  socketEmit(JOIN_TOURNAMENT, { tournamentId });
}

/** Leave a tournament room to stop receiving mutation broadcasts. */
export function leaveTournamentRoom(tournamentId: string): void {
  if (currentTournamentRoom === tournamentId) currentTournamentRoom = undefined;
  if (!tournamentId || !connected()) {
    slog('[socket] leaveTournamentRoom skipped — tournamentId=%s, connected=%s', tournamentId, connected());
    return;
  }
  slog('[socket] leaving room:', tournamentId);
  socketEmit(LEAVE_TOURNAMENT, { tournamentId });
}

export function logError(err: any): void {
  if (!err) return;
  const stack = err.stack?.toString();
  const errorMessage = isObject(err) ? JSON.stringify(err) : err;
  const payload = { stack, error: errorMessage };
  emitTmx({ data: { action: CLIENT_ERROR, payload } });
}

let keyQueue: string[] = [];
export function queueKey(key: string): void {
  keyQueue.push(key);
}
const sendKey = (key: string) => emitTmx({ data: { action: SEND_KEY, payload: { key } } });
export function sendQueuedKeys(): void {
  keyQueue.forEach(sendKey);
  keyQueue = [];
}
