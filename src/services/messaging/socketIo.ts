/**
 * Socket.IO client for real-time communication.
 * Handles WebSocket connections, message emission, and acknowledgements.
 */
import { getLoginState } from 'services/authentication/loginState';
import { getToken } from 'services/authentication/tokenManagement';
import { processDirective } from 'services/processDirective';
import { tools, version } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction, isObject } from 'functions/typeOf';
import { version as tmxVersion } from 'config/version';
import { showOSNotification } from 'services/notifications/osNotification';
import { debugConfig } from 'config/debugConfig';
import { serverConfig } from 'config/serverConfig';
import { io } from 'socket.io-client';
import { t } from 'i18n';

// constants
import { CLIENT_ERROR, SEND_KEY, TMX_DIRECTIVE, TMX_MESSAGE, JOIN_TOURNAMENT, LEAVE_TOURNAMENT } from 'constants/comsConstants';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

function getAuthorization(): { authorization: string } | undefined {
  const token = getToken();
  if (!token) return undefined;
  const authorization = `Bearer ${token}`;
  return { authorization };
}

const oi: any = {
  timestampOffset: 0,
  socket: undefined,
};

/** True after a disconnect event until cleared by `clearDisconnectFlag()`. */
let disconnectedSinceLastNav = false;

const ackRequests: Record<string, (ack: any) => void> = {};
const ackTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};
const socketQueue: any[] = [];

let mutationListener: ((data: any) => void) | null = null;

function tmxMessage(data: any): void {
  slog('[socket] tmxMessage:', { data });
}

/** Register a callback for remote tournament mutations broadcast by the server. */
export function onTournamentMutation(callback: ((data: any) => void) | null): void {
  mutationListener = callback;
}

function handleTournamentMutation(data: any): void {
  slog('[socket] received tournamentMutation — methods:', data?.methods?.length, 'tournaments:', data?.tournamentIds, 'from:', data?.userId);
  if (mutationListener) {
    mutationListener(data);
  } else {
    console.warn('[socket] tournamentMutation received but no listener registered');
  }
}

export function connectSocket(callback?: () => void): void {
  const connectionOptions: any = {
    transportOptions: { polling: { extraHeaders: getAuthorization() } },
    'force new connection': true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 'Infinity',
    timeout: 20000,
  };
  if (!oi.socket) {
    const socketPath = serverConfig.get().socketPath || process.env.SERVER || window.location.origin;
    const connectionString = `${socketPath}/tmx`;
    slog('[socket] connecting to', connectionString);
    oi.socket = io(connectionString, connectionOptions);
    oi.socket.on('ack', receiveAcknowledgement);
    oi.socket.on(TMX_MESSAGE, tmxMessage);
    oi.socket.on(TMX_DIRECTIVE, processDirective);
    oi.socket.on('tournamentMutation', handleTournamentMutation);
    oi.socket.on('connect', () => connectionEvent(callback));
    oi.socket.on('disconnect', (reason: string) => {
      slog('[socket] disconnected — reason:', reason);
      disconnectedSinceLastNav = true;
      showOSNotification({ title: 'TMX', body: 'Server connection lost' });
    });
    oi.socket.on('exception', (data: any) => {
      console.warn('[socket] server exception:', data);
    });
    oi.socket.on('timestamp', (data: any) => (oi.timestampOffset = new Date().getTime() - data.timestamp));
    oi.socket.on('connect_error', (data: any) => {
      slog('[socket] connect_error:', data?.message ?? data);
      tmxToast({ message: t('toasts.connectionError'), intent: 'is-danger' });
      disconnectSocket();
    });
  } else {
    slog('[socket] connectSocket called but socket already exists (connected=%s)', oi.socket.connected);
  }
}

export function connected(): boolean {
  return !!oi.socket;
}

export function disconnectSocket(): void {
  slog('[socket] disconnectSocket called');
  oi?.socket?.disconnect();
  setTimeout(() => delete oi.socket, 1000);
}

/**
 * Reconnect the socket if the user is logged in but the socket is gone.
 * Returns true if a reconnect was initiated.
 */
export function ensureConnected(): boolean {
  if (oi.socket?.connected) return false;
  const state = getLoginState();
  if (!state) return false;
  slog('[socket] ensureConnected — reconnecting (was disconnected)');
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

export function emitTmx({ data, ackCallback }: { data: any; ackCallback?: (ack: any) => void }): void {
  const state = getLoginState();
  const { email: userId } = state || {};
  const messageType = data.type ?? 'tmx';

  const action = () => {
    if (ackCallback && isFunction(ackCallback)) {
      const ackId = tools.UUID();
      if (data.payload) Object.assign(data.payload, { ackId });

      requestAcknowledgement({ ackId, callback: ackCallback });
    }

    const timestamp = oi.timestampOffset ? new Date().getTime() + oi.timestampOffset : new Date().getTime();
    Object.assign(data.payload || data, {
      factoryVersion: version(),
      tmxVersion,
      timestamp,
      userId,
    });

    socketEmit(messageType, data);
  };

  if (oi.socket) {
    action();
  } else {
    try {
      connectSocket(action);
    } catch {
      // Socket action failed - queue message for retry
      socketQueue.push({ header: messageType, data, ackCallback });
    }
  }
}

function socketEmit(msg: string, data: any): void {
  if (!oi.socket.connected) {
    slog('[socket] emit skipped (not connected) — msg:', msg);
  } else {
    slog('[socket] emit:', msg, data?.type ?? '');
    oi.socket.emit(msg, data);
  }
}

function connectionEvent(callback?: () => void): void {
  slog('[socket] connected — id:', oi.socket?.id);
  emitTmx({ data: { type: 'timestamp' } });
  while (socketQueue.length) {
    const message = socketQueue.pop();
    socketEmit(message.header, message.data);
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
  callback: (ack: any) => void;
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

function receiveAcknowledgement(ack: any): void {
  // Prefer ackId; fall back to uuid. Only fire once.
  const key = (ack.ackId && ackRequests[ack.ackId] && ack.ackId) || (ack.uuid && ackRequests[ack.uuid] && ack.uuid);
  if (key) ackRequests[key](ack);
}

/** Join a tournament room to receive mutation broadcasts from other clients. */
export function joinTournamentRoom(tournamentId: string): void {
  if (!tournamentId || !oi.socket?.connected) {
    slog('[socket] joinTournamentRoom skipped — tournamentId=%s, connected=%s', tournamentId, oi.socket?.connected);
    return;
  }
  slog('[socket] joining room:', tournamentId);
  oi.socket.emit(JOIN_TOURNAMENT, { tournamentId });
}

/** Leave a tournament room to stop receiving mutation broadcasts. */
export function leaveTournamentRoom(tournamentId: string): void {
  if (!tournamentId || !oi.socket?.connected) {
    slog('[socket] leaveTournamentRoom skipped — tournamentId=%s, connected=%s', tournamentId, oi.socket?.connected);
    return;
  }
  slog('[socket] leaving room:', tournamentId);
  oi.socket.emit(LEAVE_TOURNAMENT, { tournamentId });
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
