import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerApi, createServerSocket, serverFetch } from './serverNetwork';
import {
  assertServerAccess,
  registerSandboxId,
  setNetworkIsolation,
  pendingServerWriteCount,
  onNetworkRefusal,
  networkRefusalCount,
} from './networkPolicy';

const native = vi.hoisted(() => ({ sockets: [] as any[], io: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: (...args: any[]) => native.io(...args) }));
const SANDBOX = 'time-warp-issued-copy';
const SOCKET_URL = 'https://server/tmx';
const PRODUCTION_NAME = 'time-warp-cup';
registerSandboxId(SANDBOX);

afterEach(() => {
  setNetworkIsolation(false);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const answer = (config: any) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config });

describe('identity guard', () => {
  it('allows real names, notes and participant fields containing the prefix or an issued id', () => {
    const record = {
      tournamentId: 'production',
      tournamentName: PRODUCTION_NAME,
      notes: SANDBOX,
      participants: [{ participantId: SANDBOX, person: { standardFamilyName: 'time-warp-jones' } }],
    };
    expect(() => assertServerAccess({ tournamentRecord: record })).not.toThrow();
    expect(() => assertServerAccess({ notes: 'time-warp-' }, '/notes/time-warp-cup')).not.toThrow();
  });

  it.each([
    { tournamentId: SANDBOX },
    { payload: { tournamentIds: [SANDBOX] } },
    { tournamentRecord: { tournamentId: SANDBOX } },
    { tournamentRecords: { [SANDBOX]: {} } },
    { methods: [{ params: { placements: [{ tournamentId: SANDBOX }] } }] },
  ])('refuses issued sandbox identities after exit: %j', (payload) => {
    expect(() => assertServerAccess(payload)).toThrowError(expect.objectContaining({ code: 'NETWORK_ISOLATED' }));
  });

  it('does not serialize objects or interpret names as payloads', () => {
    const stringify = vi.spyOn(JSON, 'stringify');
    const body: any = { tournamentId: 'production', notes: 'time-warp-cup' };
    body.self = body;
    assertServerAccess(body);
    expect(stringify).not.toHaveBeenCalled();
    stringify.mockRestore();
  });
});

describe('HTTP chokepoint', () => {
  it('guards custom Axios adapters and fetch before dispatch, with the same rejection', async () => {
    const adapter = vi.fn(async (config) => answer(config));
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const api = createServerApi({ adapter });
    await api.post('/factory', { tournamentId: 'production', tournamentName: PRODUCTION_NAME });
    await serverFetch('/query/tournaments/production');
    setNetworkIsolation(true);
    await expect(api.post('/factory', {})).rejects.toMatchObject({ code: 'NETWORK_ISOLATED', reason: 'active' });
    await expect(serverFetch('/query')).rejects.toMatchObject({ code: 'NETWORK_ISOLATED', reason: 'active' });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    setNetworkIsolation(false);
    await expect(api.post('/factory', { tournamentId: SANDBOX })).rejects.toMatchObject({ code: 'NETWORK_ISOLATED' });
    await expect(serverFetch(`/query/tournaments/${SANDBOX}`)).rejects.toMatchObject({ code: 'NETWORK_ISOLATED' });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('aborts pending reads and rejects late answers even after isolation ends', async () => {
    let finish!: (value: any) => void;
    let signal!: AbortSignal;
    const api = createServerApi({
      adapter: (config: any) => {
        signal = config.signal;
        return new Promise((resolve) => {
          finish = () => resolve(answer(config));
        });
      },
    });
    const request = api.get('/query');
    await vi.waitFor(() => expect(finish).toBeDefined());
    const rejected = expect(request).rejects.toMatchObject({ code: 'NETWORK_ISOLATED', reason: 'stale' });
    setNetworkIsolation(true);
    expect(signal.aborted).toBe(true);
    setNetworkIsolation(false);
    finish({});
    await rejected;
  });

  it('rejects a late fetch body with the same isolation error after headers already arrived', async () => {
    let finish!: (body: any) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      }),
    );
    const response = await serverFetch('/query');
    const body = response.json();
    const rejected = expect(body).rejects.toMatchObject({ code: 'NETWORK_ISOLATED', reason: 'stale' });
    setNetworkIsolation(true);
    setNetworkIsolation(false);
    finish({ tournamentId: 'production' });
    await rejected;
  });

  it('tracks writes through the whole adapter await and preserves caller cancellation', async () => {
    let finish!: () => void;
    const adapter = (config: any) =>
      new Promise<any>((resolve) => {
        finish = () => resolve(answer(config));
      });
    const api = createServerApi({ adapter });
    const request = api.post('/upload', { tournamentId: 'production' });
    await vi.waitFor(() => expect(pendingServerWriteCount()).toBe(1));
    finish();
    await request;
    expect(pendingServerWriteCount()).toBe(0);
    const controller = new AbortController();
    controller.abort();
    await expect(api.get('/query', { signal: controller.signal })).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  });
});

describe('socket chokepoint', () => {
  function createNative() {
    const handlers = new Map<string, any>();
    const socket: any = {
      connected: false,
      connect: vi.fn(() => {
        socket.connected = true;
        return socket;
      }),
      disconnect: vi.fn(() => {
        socket.connected = false;
        return socket;
      }),
      emit: vi.fn(() => socket),
      on: vi.fn((event, handler) => {
        handlers.set(event, handler);
        return socket;
      }),
      off: vi.fn(() => socket),
      handlers,
    };
    native.io.mockReturnValueOnce(socket);
    return socket;
  }

  it('counts and drops ack callbacks owned by an earlier epoch, including after exit', () => {
    const raw = createNative();
    const nativeEmit = raw.emit;
    const socket = createServerSocket(SOCKET_URL);
    const acknowledged = vi.fn();
    socket.emit('query', { tournamentId: 'production' }, acknowledged);
    const callback = nativeEmit.mock.calls[0].at(-1);
    callback({ success: true });
    expect(acknowledged).toHaveBeenCalledTimes(1);
    const previous = networkRefusalCount('stale');
    setNetworkIsolation(true);
    callback({ success: true });
    setNetworkIsolation(false);
    callback({ success: true });
    expect(acknowledged).toHaveBeenCalledTimes(1);
    expect(networkRefusalCount('stale')).toBe(previous + 2);
  });

  it('registers before connecting, tears down pending sockets, and refuses new handshakes and emissions', () => {
    const raw = createNative();
    const connect = raw.connect;
    const emit = raw.emit;
    const disconnect = raw.disconnect;
    const socket = createServerSocket(SOCKET_URL);
    expect(native.io).toHaveBeenCalledWith(SOCKET_URL, expect.objectContaining({ autoConnect: false }));
    expect(connect).toHaveBeenCalledTimes(1);
    const handler = vi.fn();
    socket.on('mutation', handler);
    raw.handlers.get('mutation')({});
    expect(handler).toHaveBeenCalledTimes(1);
    setNetworkIsolation(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(() => socket.connect()).toThrowError(expect.objectContaining({ code: 'NETWORK_ISOLATED' }));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(() => socket.emit('mutate', {})).toThrowError(expect.objectContaining({ code: 'NETWORK_ISOLATED' }));
    expect(emit).not.toHaveBeenCalled();
    raw.handlers.get('mutation')({});
    expect(handler).toHaveBeenCalledTimes(1);
    setNetworkIsolation(false);
    raw.handlers.get('mutation')({});
    expect(handler).toHaveBeenCalledTimes(1);
    setNetworkIsolation(true);
    const other = createNative();
    const otherConnect = other.connect;
    expect(() => createServerSocket('https://server/chat')).toThrowError(
      expect.objectContaining({ code: 'NETWORK_ISOLATED' }),
    );
    expect(otherConnect).not.toHaveBeenCalled();
  });
});

describe('encoded payloads and reload identities', () => {
  it('recognizes reserved copy identities without an issued-id entry and safely parses malformed escapes', async () => {
    const imported = 'time-warp-11111111-2222-3333-4444-555555555555';
    expect(() => assertServerAccess({ tournamentId: imported })).toThrowError(
      expect.objectContaining({ reason: 'sandbox-id' }),
    );
    expect(() => assertServerAccess(undefined, '/query/tournaments/' + imported + '#%')).toThrowError(
      expect.objectContaining({ code: 'NETWORK_ISOLATED' }),
    );
    expect(() => assertServerAccess(undefined, '/query/tournaments/production#%')).not.toThrow();
  });

  it('inspects Request, multipart Request, FormData and Blob envelopes before native fetch or Axios dispatch', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const form = new FormData();
    form.set('tournamentId', SANDBOX);
    const ids = new FormData();
    ids.set('tournamentIds', SANDBOX);
    const nested = new FormData();
    nested.set('file', new Blob([JSON.stringify({ tournamentId: SANDBOX })], { type: 'application/json' }));
    const blob = new Blob([JSON.stringify({ tournamentIds: [SANDBOX] })], { type: 'application/json' });
    for (const body of [form, ids, nested, blob]) {
      await expect(serverFetch('https://server/upload', { method: 'POST', body })).rejects.toMatchObject({
        code: 'NETWORK_ISOLATED',
        reason: 'sandbox-id',
      });
      const adapter = vi.fn();
      await expect(createServerApi({ adapter }).post('/upload', body)).rejects.toMatchObject({
        code: 'NETWORK_ISOLATED',
      });
      expect(adapter).not.toHaveBeenCalled();
    }
    for (const body of [JSON.stringify({ tournamentId: SANDBOX }), form]) {
      const request = new Request('https://server/upload', { method: 'POST', body });
      await expect(serverFetch(request)).rejects.toMatchObject({ code: 'NETWORK_ISOLATED' });
      expect(request.bodyUsed).toBe(false);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

it('reports refusals synchronously even when callers catch them, without storing payloads', async () => {
  const notice = vi.fn();
  const off = onNetworkRefusal(notice);
  const previous = networkRefusalCount('active');
  setNetworkIsolation(true);
  await serverFetch('/factory', { method: 'POST', body: 'secret' }).catch(() => undefined);
  expect(notice).toHaveBeenCalledWith(expect.objectContaining({ code: 'NETWORK_ISOLATED', reason: 'active' }));
  expect(networkRefusalCount('active')).toBe(previous + 1);
  expect(Object.keys(notice.mock.calls[0][0])).not.toContain('payload');
  off();
});
