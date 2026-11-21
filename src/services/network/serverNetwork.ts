/** The only application module allowed to create server HTTP clients, fetches or realtime sockets. */
import { io, type Socket, type ManagerOptions, type SocketOptions } from 'socket.io-client';
import axios, { type AxiosRequestConfig, type AxiosInstance } from 'axios';
import {
  assertServerAccess,
  assertServerEpoch,
  isSandboxId,
  networkIsIsolated,
  noteNetworkRefusal,
  onNetworkIsolation,
  requestSignal,
  serverRequestEpoch,
  trackServerWrite,
} from './networkPolicy';

export { assertServerAccess, isNetworkIsolationError, NetworkIsolationError } from './networkPolicy';

function payloadValue(value: any): any {
  // Axios retries and callers may supply encoded JSON. Ordinary text remains data, not an identity search target.
  if (typeof value !== 'string' || !/^\s*(?:\[|{)/.test(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Decode structured transport envelopes before checking identities; never search ordinary prose. */
async function inspectBody(body: unknown): Promise<unknown> {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const fields: Record<string, unknown[]> = {};
    for (const [key, value] of body.entries()) {
      const parsed = await inspectBody(value);
      assertServerAccess({ [key]: key.endsWith('Ids') && typeof parsed === 'string' ? parsed.split(',') : parsed });
      (fields[key] ??= []).push(parsed);
    }
    return Object.values(fields).flat();
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return inspectBody(await body.text());
  if (body instanceof URLSearchParams) {
    for (const [key, value] of body) assertServerAccess({ [key]: payloadValue(value) });
    return [...body.values()].map(payloadValue);
  }
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return inspectBody(new TextDecoder().decode(body as AllowSharedBufferSource));
  }
  return payloadValue(body);
}

/** Guard the adapter, including custom adapters, immediately before dispatch and after its answer. */
export function createServerApi(options: AxiosRequestConfig = {}): AxiosInstance {
  const client = axios.create(options);
  client.interceptors.request.use((config: any) => {
    const owner = config.networkEpoch ?? serverRequestEpoch();
    assertServerEpoch(owner);
    const payload = config.networkPayload ?? payloadValue(config.data);
    assertServerAccess(undefined, config.url);
    const adapter = axios.getAdapter(config.adapter ?? client.defaults.adapter);
    config.networkEpoch = owner;
    config.networkPayload = payload;
    config.adapter = async (request: any) => {
      assertServerEpoch(owner);
      assertServerAccess([request.params, await inspectBody(payload)], request.url);
      assertServerEpoch(owner);
      // Keep Axios's outer cancellation check on the caller signal. Aborting our native dispatch signal must not
      // overwrite the typed isolation error with Axios's generic ERR_CANCELED after the adapter settles.
      const dispatchRequest = { ...request, signal: requestSignal(request.signal) };
      const done = trackServerWrite(request, request.method);
      try {
        const response = await adapter(dispatchRequest);
        assertServerEpoch(owner);
        return response;
      } catch (error) {
        // An abort caused by isolation and a late response have the same typed failure on every HTTP API.
        assertServerEpoch(owner);
        throw error;
      } finally {
        done();
      }
    };
    return config;
  });
  return client;
}

/** Response bodies may still be arriving after fetch resolves its headers. Keep that await in the same epoch. */
function guardResponse(response: Response, owner: number): Response {
  const bodyMethods = new Set(['json', 'text', 'arrayBuffer', 'blob', 'formData', 'bytes']);
  return new Proxy(response, {
    get(target, key) {
      assertServerEpoch(owner);
      const value = Reflect.get(target, key, target);
      if (key === 'clone') return () => guardResponse(target.clone(), owner);
      if (typeof value !== 'function') return value;
      if (!bodyMethods.has(String(key))) return value.bind(target);
      return async (...args: any[]) => {
        assertServerEpoch(owner);
        try {
          const result = await value.apply(target, args);
          assertServerEpoch(owner);
          return result;
        } catch (error) {
          assertServerEpoch(owner);
          throw error;
        }
      };
    },
  });
}

export async function serverFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
  const url = request?.url ?? String(input);
  assertServerAccess(undefined, url);
  const owner = serverRequestEpoch();
  // Clone Request bodies for inspection so dispatch still consumes the original exactly once.
  const clone = request?.body && init?.body == null ? request.clone() : undefined;
  const encodedForm = clone?.headers
    .get('content-type')
    ?.match(/^(multipart\/form-data|application\/x-www-form-urlencoded)/i);
  const body = init?.body ?? (clone ? await (encodedForm ? clone.formData() : clone.text()) : undefined);
  assertServerAccess(await inspectBody(body), url);
  assertServerEpoch(owner);
  const done = trackServerWrite({}, init?.method ?? request?.method);
  try {
    const response = await fetch(input, { ...init, signal: requestSignal(init?.signal ?? request?.signal) });
    assertServerEpoch(owner);
    return guardResponse(response, owner);
  } catch (error) {
    assertServerEpoch(owner);
    throw error;
  } finally {
    done();
  }
}

/** Sockets are registered before connecting, so an isolation transition also cancels an incomplete handshake. */
export function createServerSocket(url: string, options: Partial<ManagerOptions & SocketOptions> = {}): Socket {
  const socket = io(url, { ...options, autoConnect: false });
  const connect = socket.connect.bind(socket);
  const emit = socket.emit.bind(socket);
  const on = socket.on.bind(socket);
  const off = socket.off.bind(socket);
  const wrappers = new Map<string, Map<(...args: any[]) => void, (...args: any[]) => void>>();
  // A weak reference lets abandoned per-tournament sockets be collected while still tracking reconnectable sockets.
  const reference = new WeakRef(socket);
  const release = onNetworkIsolation(() => {
    const live = reference.deref();
    if (live) live.disconnect();
    else release();
  });
  let connectionEpoch = serverRequestEpoch();
  socket.connect = socket.open = () => {
    assertServerAccess(options.query, url);
    connectionEpoch = serverRequestEpoch();
    connect();
    return socket;
  };
  socket.emit = ((event: string, ...args: any[]) => {
    assertServerAccess(args, url);
    if (event.endsWith(':tournament') && isSandboxId(args[0])) assertServerAccess({ tournamentId: args[0] }, url);
    const owner = serverRequestEpoch();
    const delivered = args.map((arg) =>
      typeof arg === 'function'
        ? (...values: any[]) => {
            if (networkIsIsolated() || owner !== serverRequestEpoch()) noteNetworkRefusal('stale');
            else arg(...values);
          }
        : arg,
    );
    return emit(event, ...delivered);
  }) as typeof socket.emit;
  socket.on = ((event: string, handler: (...args: any[]) => void) => {
    const handlers = wrappers.get(event) ?? new Map();
    const wrapped = (...args: any[]) => {
      // Inbound delivery is not a request and cannot reject its caller. Discard it with policy diagnostics.
      if (networkIsIsolated() || connectionEpoch !== serverRequestEpoch()) noteNetworkRefusal('stale');
      else handler(...args);
    };
    handlers.set(handler, wrapped);
    wrappers.set(event, handlers);
    return on(event, wrapped);
  }) as typeof socket.on;
  socket.off = ((event?: string, handler?: (...args: any[]) => void) => {
    const wrapped = event && handler ? wrappers.get(event)?.get(handler) : undefined;
    if (event && handler) wrappers.get(event)?.delete(handler);
    else if (event) wrappers.delete(event);
    else wrappers.clear();
    if (event === undefined) return off();
    return handler === undefined ? off(event) : off(event, wrapped ?? handler);
  }) as typeof socket.off;
  socket.removeListener = socket.off;
  if (options.autoConnect !== false) socket.connect();
  return socket;
}
