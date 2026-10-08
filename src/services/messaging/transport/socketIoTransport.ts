import { io } from 'socket.io-client';

// types
import type { MessageTransport, TransportOptions, TransportStatus } from './messageTransport';

function bearer(getToken: () => string | undefined): { authorization: string } | undefined {
  const token = getToken();
  if (!token) return undefined;
  const authorization = `Bearer ${token}`;
  return { authorization };
}

/**
 * Socket.IO implementation of `MessageTransport` — the only place in TMX that
 * opens the `/tmx` socket.
 */
export function createSocketIoTransport({ url, getToken }: TransportOptions): MessageTransport {
  const socket = io(url, {
    // `auth` is a function so socket.io-client re-invokes it before every
    // (re)connect, always presenting the *current* token. The server's
    // SocketGuard prefers handshake.auth.token over the Authorization header
    // precisely because the header is baked in at initial connect and goes
    // stale on the first reconnect after a token refresh — which is what left
    // an expired-then-refreshed /tmx session silently rejected on every
    // executionQueue (the /hiveid socket clients got this fix on 2026-06-01;
    // /tmx did not until now). extraHeaders is kept for the polling handshake.
    auth: (cb: (data: { token?: string }) => void) => cb({ token: getToken() ?? undefined }),
    transportOptions: { polling: { extraHeaders: bearer(getToken) } },
    forceNew: true,
    reconnectionDelay: 1000,
    // A NUMBER, not the string 'Infinity'. socket.io compares
    // `attempts >= reconnectionAttempts`; against a string that comparison is
    // always false, so the old value never gave up only by accident.
    reconnectionAttempts: Infinity,
    timeout: 20000,
  });

  // The polling handshake's Authorization header was fixed at creation, so after a token refresh
  // every reconnect over polling presented the expired one. Re-read it before each attempt.
  socket.io.on('reconnect_attempt', () => {
    const polling = (socket.io.opts.transportOptions as any)?.polling;
    if (polling) polling.extraHeaders = bearer(getToken);
  });

  return {
    connect: () => {
      socket.connect();
    },
    disconnect: () => {
      socket.disconnect();
    },
    reconnect: () => {
      socket.disconnect();
      socket.connect();
    },
    isConnected: () => socket.connected,
    connectionId: () => socket.id,
    send: (event, data) => {
      if (!socket.connected) return false;
      socket.emit(event, data);
      return true;
    },
    on: (event, handler) => {
      socket.on(event, handler);
    },
    onStatus: (handler: (status: TransportStatus, info?: any) => void) => {
      socket.on('connect', () => handler('connected'));
      socket.on('disconnect', (reason: string) => handler('disconnected', reason));
      socket.on('connect_error', (err: any) => handler('error', err));
    },
  };
}
