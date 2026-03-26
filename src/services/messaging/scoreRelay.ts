/**
 * Score relay client — connects to the score-relay /live namespace
 * to receive live score updates from epixodic trackers.
 *
 * Relay URL is derived from the factory server URL:
 * - Production: same host, /relay path (nginx proxy)
 * - Local dev: same host, port 8384
 */
import { serverConfig } from 'config/serverConfig';
import { debugConfig } from 'config/debugConfig';
import { io, Socket } from 'socket.io-client';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

let relaySocket: Socket | undefined;
let currentTournamentId: string | undefined;
let tournamentScoreHandler: ((data: any) => void) | null = null;
const matchUpCallbacks = new Map<string, (data: any) => void>();

function getRelayUrl(): string {
  const serverUrl = serverConfig.get().socketPath || window.location.origin;

  try {
    const url = new URL(serverUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      // Local dev: relay server runs on port 8384
      url.port = '8384';
      return url.origin;
    }
  } catch {
    // Not a valid URL — fall through to append /relay
  }

  // Production: nginx proxies /relay/ to the relay server
  return `${serverUrl}/relay`;
}

export function connectRelay(tournamentId: string): void {
  if (relaySocket?.connected && currentTournamentId === tournamentId) return;

  disconnectRelay();
  currentTournamentId = tournamentId;

  const relayUrl = getRelayUrl();
  const url = `${relayUrl}/live`;
  slog('[relay] connecting to', url);

  relaySocket = io(url, {
    transports: ['websocket'],
    forceNew: true,
  });

  relaySocket.on('connect', () => {
    slog('[relay] connected — subscribing to tournament:', tournamentId);
    relaySocket!.emit('subscribe:tournament', tournamentId);

    // Re-subscribe to any active matchUp-level subscriptions
    for (const matchUpId of matchUpCallbacks.keys()) {
      relaySocket!.emit('subscribe', matchUpId);
    }
  });

  relaySocket.on('score', (data: any) => {
    slog('[relay] score received:', data.matchUpId, data.score);

    // Per-matchUp callback (scoring dialog)
    const matchUpCb = matchUpCallbacks.get(data.matchUpId);
    if (matchUpCb) matchUpCb(data);

    // Tournament-wide handler (table refresh + pulse)
    if (tournamentScoreHandler) tournamentScoreHandler(data);
  });

  relaySocket.on('disconnect', (reason: string) => {
    slog('[relay] disconnected:', reason);
  });

  relaySocket.on('connect_error', (err: Error) => {
    slog('[relay] connection error:', err.message);
  });
}

export function disconnectRelay(): void {
  if (relaySocket) {
    slog('[relay] disconnecting');
    relaySocket.disconnect();
    relaySocket = undefined;
  }
  currentTournamentId = undefined;
  matchUpCallbacks.clear();
  tournamentScoreHandler = null;
}

/** Set the handler for tournament-level score updates (table refresh + pulse). */
export function onTournamentScore(handler: ((data: any) => void) | null): void {
  tournamentScoreHandler = handler;
}

/** Subscribe to a specific matchUp (e.g., when scoring dialog opens). */
export function subscribeToMatchUp(matchUpId: string, callback: (data: any) => void): void {
  matchUpCallbacks.set(matchUpId, callback);
  if (relaySocket?.connected) {
    relaySocket.emit('subscribe', matchUpId);
  }
}

/** Unsubscribe from a specific matchUp (e.g., when scoring dialog closes). */
export function unsubscribeFromMatchUp(matchUpId: string): void {
  matchUpCallbacks.delete(matchUpId);
  if (relaySocket?.connected) {
    relaySocket.emit('unsubscribe', matchUpId);
  }
}

/** Check whether the relay is connected. */
export function relayConnected(): boolean {
  return !!relaySocket?.connected;
}
