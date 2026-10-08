/**
 * What TMX needs from a connection to the server, with no Socket.IO in it.
 *
 * `socketIo.ts` owns the application protocol on top of this — ack
 * correlation, room membership, chat wiring, reconnect recovery — and talks
 * to the server only through a `MessageTransport`. Socket.IO is the only
 * implementation today (`socketIoTransport.ts`); a managed pub/sub service
 * would be a second one.
 *
 * See Mentat/planning/REALTIME_TRANSPORT_PLUGGABILITY.md.
 */

export type TransportStatus = 'connected' | 'disconnected' | 'error';

export interface MessageTransport {
  /** Open the connection, or re-open one an explicit `disconnect()` stopped. */
  connect(): void;
  /** Close the connection and stop reconnecting until `connect()` is called again. */
  disconnect(): void;
  /** Drop and re-establish the connection so the handshake presents the current token. */
  reconnect(): void;
  isConnected(): boolean;
  /** Server-visible id of the live connection, when there is one. */
  connectionId(): string | undefined;
  /**
   * Send `event` with `data`. Returns false — and sends nothing — when there is
   * no live connection; the caller decides whether that is worth surfacing.
   */
  send(event: string, data: unknown): boolean;
  /** Subscribe to a server event. */
  on(event: string, handler: (data: any) => void): void;
  /**
   * Connection lifecycle. `connected` fires on the first connect and on every
   * reconnect; `info` carries the disconnect reason or the connect error.
   */
  onStatus(handler: (status: TransportStatus, info?: any) => void): void;
}

export interface TransportOptions {
  /** Full endpoint URL, namespace included (e.g. `https://host/tmx`). */
  url: string;
  /** Read on every (re)connect, so a refreshed token is presented without rebuilding the transport. */
  getToken: () => string | undefined;
}
