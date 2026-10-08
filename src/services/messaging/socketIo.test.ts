import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The application protocol in socketIo.ts, driven through a fake
 * MessageTransport — which is the point of the seam: none of this needs a
 * socket.
 */

const fake = vi.hoisted(() => {
  const state: any = {};
  state.reset = () => {
    state.connected = false;
    state.sent = [] as Array<{ event: string; data: any }>;
    state.handlers = {} as Record<string, (data: any) => void>;
    state.status = undefined as undefined | ((status: string, info?: any) => void);
    state.connection = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      reconnect: vi.fn(),
      isConnected: () => state.connected,
      connectionId: () => 'conn-1',
      send: (event: string, data: any) => {
        if (!state.connected) return false;
        state.sent.push({ event, data });
        return true;
      },
      on: (event: string, handler: any) => (state.handlers[event] = handler),
      onStatus: (handler: any) => (state.status = handler),
    };
    // Simulate the connection coming up (first connect or a reconnect).
    state.up = () => {
      state.connected = true;
      state.status('connected');
    };
    state.authException = vi.fn(() => false);
    state.login = { email: 'td@x.com' };
    state.toast = vi.fn();
    // IndexedDB, as outboxStore.ts presents it.
    state.rows = new Map<string, any>();
    state.persistFails = false;
    // Commands over HTTP (Phase 1): off unless a test turns it on.
    state.http = false;
    state.posted = [] as any[];
    state.answer = (data: any): any => ({
      deliver: { event: 'ack', payload: { ackId: data.payload.ackId, success: true } },
    });
    state.chatSend = undefined as undefined | ((data: any) => void);
    state.chatAccepted = vi.fn();
    state.resumed = 0;
    state.store = {
      persistMessage: vi.fn(async (row: any) => {
        if (state.persistFails) throw new Error('quota');
        state.rows.set(row.id, structuredClone(row));
      }),
      forgetMessage: vi.fn(async (id: string) => state.rows.delete(id)),
      loadMessages: vi.fn(async (userId: string) =>
        [...state.rows.values()].filter((row) => row.userId === userId).sort((a, b) => a.queuedAt - b.queuedAt),
      ),
      claimMessage: vi.fn(async (id: string) => state.rows.delete(id)),
    };
    state.down = () => {
      state.connected = false;
      state.status('disconnected', 'transport close');
    };
  };
  return state;
});

vi.mock('services/messaging/transport/socketIoTransport', () => ({
  createSocketIoTransport: () => fake.connection,
}));
vi.mock('services/version/checkFactoryVersion', () => ({
  checkFactoryVersion: vi.fn(async () => undefined),
  resetFactoryVersionCheck: vi.fn(),
}));
vi.mock('services/notifications/osNotification', () => ({ showOSNotification: vi.fn() }));
vi.mock('services/session/sessionGuard', () => ({ handleSocketException: (d: any) => fake.authException(d) }));
vi.mock('services/authentication/loginState', () => ({ getLoginState: () => fake.login }));
vi.mock('services/authentication/tokenManagement', () => ({ getToken: () => 'tok' }));
vi.mock('services/processDirective', () => ({ processDirective: vi.fn() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: (...args: any[]) => fake.toast(...args) }));
vi.mock('services/messaging/outboxStore', () => ({
  persistMessage: (row: any) => fake.store.persistMessage(row),
  forgetMessage: (id: string) => fake.store.forgetMessage(id),
  loadMessages: (userId: string) => fake.store.loadMessages(userId),
  claimMessage: (id: string) => fake.store.claimMessage(id),
}));
vi.mock('services/chat/chatService', () => ({
  setChatSendFn: (fn: any) => (fake.chatSend = fn),
  setChatGapFn: vi.fn(),
  receiveMessage: vi.fn(),
  receiveAccepted: (data: any) => fake.chatAccepted(data),
  receiveRejected: vi.fn(),
  receiveHistory: vi.fn(),
  setOnlineCount: vi.fn(),
}));
vi.mock('services/chat/adminChatService', () => ({
  setAdminMonitorFns: vi.fn(),
  receiveAdminChatFeed: vi.fn(),
  receiveAdminChatHistory: vi.fn(),
  rejoinChatMonitorIfActive: vi.fn(),
}));
vi.mock('config/serverConfig', () => ({
  serverConfig: { get: () => ({ socketPath: 'http://server', commandsOverHttp: fake.http }) },
}));
vi.mock('services/messaging/transport/httpCommands', () => ({
  HTTP_COMMANDS: new Set(['executionQueue', 'chatMessage']),
  postCommand: async (event: string, data: any) => {
    fake.posted.push({ event, data });
    return fake.answer(data);
  },
  resumeCommands: () => (fake.resumed += 1),
}));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({ socketLog: false }) } }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

// A fresh copy of the module after vi.resetModules().
type SocketIo = Awaited<ReturnType<typeof importSocketIo>>;
const importSocketIo = () => import('./socketIo');

// The first import transforms the whole module graph; on a loaded machine that alone outran the
// 10s hook timeout of the first beforeEach. Pay it once, here, with room to spare: the transform
// cache survives vi.resetModules(), so every later import is quick.
beforeAll(() => importSocketIo(), 60_000);

describe('socketIo over a MessageTransport', () => {
  let socketIo: SocketIo;
  let clientIdentity: typeof import('./clientIdentity');
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    fake.reset();
    vi.resetModules();
    socketIo = await importSocketIo();
    clientIdentity = await import('./clientIdentity');
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  const mutations = () => fake.sent.filter((m: any) => m.event === 'executionQueue');
  const executionQueue = () => ({
    type: 'executionQueue',
    payload: { methods: [{ method: 'm' }], tournamentIds: ['t1'] },
  });

  // Defect: connectSocket passed its callback to EVERY `connect`. When emitTmx creates the
  // connection lazily the callback is the action that emits the mutation, so the mutation was
  // re-sent on every reconnect for the life of the page.
  it('sends a lazily-connected mutation once, not again on every reconnect', () => {
    socketIo.emitTmx({ data: executionQueue(), ackCallback: vi.fn() });
    expect(mutations()).toHaveLength(0); // no connection yet

    fake.up();
    expect(mutations()).toHaveLength(1);

    fake.down();
    fake.up();
    fake.down();
    fake.up();
    expect(mutations()).toHaveLength(1);
  });

  it("stamps this tab's originClientId on what it sends", () => {
    socketIo.connectSocket();
    fake.up();
    socketIo.emitTmx({ data: executionQueue() });
    expect(mutations()[0].data.payload.originClientId).toBe(clientIdentity.getOriginClientId());
  });

  it('routes the ack to the callback registered for its ackId', () => {
    socketIo.connectSocket();
    fake.up();
    const ackCallback = vi.fn();
    socketIo.emitTmx({ data: executionQueue(), ackCallback });
    const { ackId } = mutations()[0].data.payload;

    fake.handlers.ack({ ackId, success: true });
    expect(ackCallback).toHaveBeenCalledWith({ ackId, success: true });
  });

  // P49: every ack passes through here, on either transport — this tab's own mutation moves its sync point.
  it('an ack with write times moves the sync point', async () => {
    const sync = await import('services/staleness/serverSync');
    sync.setServerSync('t1', '2026-10-08T19:29:00.000Z');
    socketIo.connectSocket();
    fake.up();
    socketIo.emitTmx({ data: executionQueue(), ackCallback: vi.fn() });
    const { ackId } = mutations()[0].data.payload;

    fake.handlers.ack({
      ackId,
      success: true,
      previousServerUpdatedAt: { t1: '2026-10-08T19:29:00.000Z' },
      serverUpdatedAt: { t1: '2026-10-08T19:30:00.000Z' },
    });
    expect(sync.serverIsAhead('t1', '2026-10-08T19:30:00.000Z')).toBe(false);
  });

  // D1 (CA, 2026-10-08): nothing is sent while offline; it is queued and replayed on connect.
  it('queues messages sent while offline and replays them in order on reconnect', () => {
    socketIo.connectSocket();
    fake.up();
    fake.down();
    socketIo.emitTmx({ data: { type: 'executionQueue', payload: { methods: [{ method: 'a' }] } } });
    socketIo.emitTmx({ data: { type: 'executionQueue', payload: { methods: [{ method: 'b' }] } } });
    expect(mutations()).toHaveLength(0);
    expect(socketIo.queuedMessageCount()).toBe(2);

    fake.up();

    expect(mutations().map((m: any) => m.data.payload.methods[0].method)).toEqual(['a', 'b']);
    expect(socketIo.queuedMessageCount()).toBe(0);
  });

  it('replays only after the tournament room is re-joined', () => {
    socketIo.connectSocket();
    fake.up();
    socketIo.joinTournamentRoom('t1');
    fake.down();
    socketIo.emitTmx({ data: executionQueue() });
    fake.sent.length = 0;

    fake.up();

    const order = fake.sent.map((m: any) => m.event);
    expect(order.indexOf('joinTournament')).toBeLessThan(order.indexOf('executionQueue'));
  });

  it('does not queue what a connect rebuilds anyway', () => {
    socketIo.connectSocket();
    fake.up();
    fake.down();
    socketIo.emitTmx({ data: { type: 'timestamp' } });
    expect(socketIo.queuedMessageCount()).toBe(0);
  });

  it('cancel() withdraws a queued message so it is never replayed', () => {
    socketIo.connectSocket();
    fake.up();
    fake.down();
    const handle = socketIo.emitTmx({ data: executionQueue() });

    expect(handle.cancel()).toBe(true);
    fake.up();
    expect(mutations()).toHaveLength(0);
  });

  it('cancel() reports false once the message has been sent', () => {
    socketIo.connectSocket();
    fake.up();
    const handle = socketIo.emitTmx({ data: executionQueue() });
    expect(handle.cancel()).toBe(false);
    expect(mutations()).toHaveLength(1);
  });

  it('cancel() before the first connect stops a lazily-connected message', () => {
    const handle = socketIo.emitTmx({ data: executionQueue() });
    expect(handle.cancel()).toBe(true);
    fake.up();
    expect(mutations()).toHaveLength(0);
  });

  it('keeps what it could not replay when the connection drops mid-flush', () => {
    socketIo.connectSocket();
    fake.up();
    fake.down();
    socketIo.emitTmx({ data: executionQueue() });
    socketIo.emitTmx({ data: executionQueue() });
    // The connection comes up, carries one message, and drops again.
    let sends = 0;
    const send = fake.connection.send;
    fake.connection.send = (event: string, data: any) => {
      if (event === 'executionQueue' && ++sends > 1) return false;
      return send(event, data);
    };
    fake.up();

    expect(mutations()).toHaveLength(1);
    expect(socketIo.queuedMessageCount()).toBe(1);
  });

  it('warns when the offline queue overflows and drops the oldest', () => {
    socketIo.connectSocket();
    fake.up();
    fake.down();
    for (let i = 0; i < 501; i++) socketIo.emitTmx({ data: executionQueue() });
    expect(socketIo.queuedMessageCount()).toBe(500);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('offline queue full');
  });

  it('rejoins the current tournament room after a reconnect', () => {
    socketIo.connectSocket();
    fake.up();
    socketIo.joinTournamentRoom('t1');
    fake.down();
    fake.sent.length = 0;

    fake.up();
    expect(fake.sent).toContainEqual({ event: 'joinTournament', data: { tournamentId: 't1' } });
  });

  it('runs reconnect listeners on a reconnect but not on the first connect', () => {
    const listener = vi.fn();
    socketIo.onSocketReconnect(listener);
    socketIo.connectSocket();

    fake.up();
    expect(listener).not.toHaveBeenCalled();

    fake.down();
    fake.up();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// The D1 queue persisted (CA, 2026-10-08): a durable message (one the client has already acted on)
// also waits in IndexedDB, so a reload does not lose it.
describe('socketIo offline queue across a reload', () => {
  let socketIo: SocketIo;
  let warn: ReturnType<typeof vi.spyOn>;
  let info: ReturnType<typeof vi.spyOn>;

  // Resolves once every pending IndexedDB promise (and what it chains) has run.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const methodsSent = () =>
    fake.sent.filter((m: any) => m.event === 'executionQueue').map((m: any) => m.data.payload.methods[0].method);
  const mutation = (method: string) => ({ type: 'executionQueue', payload: { methods: [{ method }] } });
  // A fresh page: the module state is gone, IndexedDB (fake.rows) is not.
  const reload = async () => {
    const rows = fake.rows;
    fake.reset();
    fake.rows = rows;
    vi.resetModules();
    socketIo = await importSocketIo();
  };
  const goOffline = () => {
    socketIo.connectSocket();
    fake.up();
    fake.down();
  };

  beforeEach(async () => {
    fake.reset();
    vi.resetModules();
    socketIo = await importSocketIo();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    info.mockRestore();
  });

  it('writes a durable message to IndexedDB while it waits, and nothing else', async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('durable'), durable: true });
    socketIo.emitTmx({ data: mutation('memoryOnly') });
    await settle();

    const rows = [...fake.rows.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: 'executionQueue', userId: 'td@x.com' });
    expect(rows[0].data.payload.methods[0].method).toBe('durable');
  });

  it('sends a durable message straight away when connected, without touching IndexedDB', async () => {
    socketIo.connectSocket();
    fake.up();
    socketIo.emitTmx({ data: mutation('a'), durable: true });
    await settle();
    expect(methodsSent()).toEqual(['a']);
    expect(fake.store.persistMessage).not.toHaveBeenCalled();
  });

  it('replays a durable message on reconnect and removes it from IndexedDB', async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('a'), durable: true });
    await settle();

    fake.up();
    await settle();

    expect(methodsSent()).toEqual(['a']);
    expect(fake.rows.size).toBe(0);
  });

  it('replays what a reload would have lost once the same user connects again', async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('beforeReload'), durable: true });
    socketIo.emitTmx({ data: mutation('chatty') }); // memory only: lost with the page
    await settle();

    await reload();
    socketIo.connectSocket();
    fake.up();
    await settle();

    expect(methodsSent()).toEqual(['beforeReload']);
    expect(fake.rows.size).toBe(0);
  });

  it('replays the earlier page before what this page queued', async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('first'), durable: true });
    await settle();

    await reload();
    socketIo.connectSocket(); // the restore starts here, still offline
    await settle();
    socketIo.emitTmx({ data: mutation('second'), durable: true });
    await settle();

    fake.up();
    await settle();
    expect(methodsSent()).toEqual(['first', 'second']);
  });

  it("leaves another user's messages in IndexedDB for that user", async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('theirs'), durable: true });
    await settle();

    await reload();
    fake.login = { email: 'someone-else@x.com' };
    socketIo.connectSocket();
    fake.up();
    await settle();

    expect(methodsSent()).toEqual([]);
    expect(fake.rows.size).toBe(1);
  });

  it('does not send a message another tab has already claimed', async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('a'), durable: true });
    await settle();

    fake.rows.clear(); // the other tab took it
    fake.up();
    await settle();
    expect(methodsSent()).toEqual([]);
    expect(socketIo.queuedMessageCount()).toBe(0);
  });

  it('cancel() removes a durable message from IndexedDB too', async () => {
    goOffline();
    const handle = socketIo.emitTmx({ data: mutation('a'), durable: true });
    await settle();

    expect(handle.cancel()).toBe(true);
    await settle();
    expect(fake.rows.size).toBe(0);
  });

  it('still sends from memory when IndexedDB would not take the message, and says a reload would lose it', async () => {
    fake.persistFails = true;
    goOffline();
    socketIo.emitTmx({ data: mutation('a'), durable: true });
    await settle();
    expect(String(warn.mock.calls[0][0])).toContain('a reload would lose it');

    fake.up();
    await settle();
    expect(methodsSent()).toEqual(['a']);
  });

  it('puts a claimed message back when the connection drops before it is sent', async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('a'), durable: true });
    await settle();

    const send = fake.connection.send;
    fake.connection.send = (event: string, data: any) => (event === 'executionQueue' ? false : send(event, data));
    fake.up();
    await settle();

    expect(methodsSent()).toEqual([]);
    expect(socketIo.queuedMessageCount()).toBe(1);
    expect(fake.rows.size).toBe(1);
  });

  it('holds a message sent during a replay behind it, so the server sees them in order', async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('queued'), durable: true });
    await settle();

    fake.up(); // the replay is now waiting on its IndexedDB claim
    socketIo.emitTmx({ data: mutation('fresh') });
    await settle();
    expect(methodsSent()).toEqual(['queued', 'fresh']);
  });

  it('forgets a durable message dropped from a full queue', async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('oldest'), durable: true });
    for (let i = 0; i < 500; i++) socketIo.emitTmx({ data: mutation('filler') });
    await settle();
    expect(fake.store.forgetMessage).toHaveBeenCalledTimes(1);
    expect(fake.rows.size).toBe(0);
  });

  it('says so when the server rejects a message replayed after a reload', async () => {
    goOffline();
    socketIo.emitTmx({ data: mutation('a'), ackCallback: vi.fn(), durable: true });
    await settle();

    await reload();
    socketIo.connectSocket();
    fake.up();
    await settle();

    const { ackId } = fake.sent.find((m: any) => m.event === 'executionQueue').data.payload;
    fake.handlers.ack({ ackId, error: { message: 'no such draw' } });
    expect(fake.toast).toHaveBeenCalledWith({ message: 'toasts.offlineChangeRejected', intent: 'is-danger' });

    fake.handlers.ack({ ackId, success: true }); // a success needs nothing: the edit was applied locally
    expect(fake.toast).toHaveBeenCalledTimes(1);
  });
});

// Realtime transport Phase 1: with commandsOverHttp, executionQueue goes as POST /factory and the
// HTTP answer is its ack. Queueing, order and persistence are unchanged.
describe('socketIo with commands over HTTP', () => {
  let socketIo: SocketIo;
  let warn: ReturnType<typeof vi.spyOn>;
  let info: ReturnType<typeof vi.spyOn>;

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const mutation = (method: string) => ({ type: 'executionQueue', payload: { methods: [{ method }] } });
  const postedMethods = () => fake.posted.map((p: any) => p.data.payload.methods[0].method);
  const socketMutations = () => fake.sent.filter((m: any) => m.event === 'executionQueue');

  beforeEach(async () => {
    fake.reset();
    fake.http = true;
    vi.resetModules();
    socketIo = await importSocketIo();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    info.mockRestore();
  });

  it('sends a mutation over HTTP and routes the answer to its ack callback', async () => {
    socketIo.connectSocket();
    fake.up();
    const ackCallback = vi.fn();
    socketIo.emitTmx({ data: mutation('a'), ackCallback });
    await settle();

    expect(socketMutations()).toHaveLength(0);
    expect(postedMethods()).toEqual(['a']);
    const { ackId } = fake.posted[0].data.payload;
    expect(ackCallback).toHaveBeenCalledWith({ ackId, success: true });
  });

  it('sends a chat message over HTTP and hands the answer to the chat service as chatAccepted', async () => {
    const accepted = { clientMsgId: 'c1', seq: 3, timestamp: 5 };
    fake.answer = () => ({ deliver: { event: 'chatAccepted', payload: accepted } });
    socketIo.connectSocket();
    fake.up();
    fake.chatSend?.({ tournamentId: 't1', message: 'hi', clientMsgId: 'c1' });
    await settle();

    expect(fake.posted.map((p: any) => p.event)).toEqual(['chatMessage']);
    expect(fake.sent.some((m: any) => m.event === 'chatMessage')).toBe(false);
    expect(fake.chatAccepted).toHaveBeenCalledWith(accepted);
  });

  it("keeps everything else on the socket — the room, the server's clock", async () => {
    socketIo.connectSocket();
    fake.up();
    socketIo.joinTournamentRoom('t1');
    await settle();
    expect(fake.sent.map((m: any) => m.event)).toEqual(expect.arrayContaining(['timestamp', 'joinTournament']));
    expect(fake.posted).toHaveLength(0);
  });

  it('still queues while offline and replays over HTTP, in order, on connect', async () => {
    socketIo.connectSocket();
    fake.up();
    fake.down();
    socketIo.emitTmx({ data: mutation('a') });
    socketIo.emitTmx({ data: mutation('b') });
    await settle();
    expect(fake.posted).toHaveLength(0);

    fake.up();
    await settle();
    expect(postedMethods()).toEqual(['a', 'b']);
  });

  it('a refusal is an ack like any other', async () => {
    fake.answer = (data: any) => ({
      deliver: { event: 'ack', payload: { ackId: data.payload.ackId, error: { message: 'no', code: 'ERR_X' } } },
    });
    socketIo.connectSocket();
    fake.up();
    const ackCallback = vi.fn();
    socketIo.emitTmx({ data: mutation('a'), ackCallback });
    await settle();
    expect(ackCallback.mock.calls[0][0].error).toEqual({ message: 'no', code: 'ERR_X' });
  });

  it('leaves an unanswered non-durable command to its sender, unacked and not re-queued', async () => {
    fake.answer = () => ({ unreachable: 'no response' });
    socketIo.connectSocket();
    fake.up();
    const ackCallback = vi.fn();
    socketIo.emitTmx({ data: mutation('a'), ackCallback });
    await settle();
    expect(ackCallback).not.toHaveBeenCalled();
    expect(socketIo.queuedMessageCount()).toBe(0);
  });

  it('re-queues unanswered durable commands in the order they were sent, and replays them on the next connect', async () => {
    fake.answer = () => ({ unreachable: 'no response' });
    socketIo.connectSocket();
    fake.up();
    socketIo.emitTmx({ data: mutation('a'), durable: true });
    socketIo.emitTmx({ data: mutation('b'), durable: true });
    await settle();
    fake.answer = (data: any) => ({ deliver: { event: 'ack', payload: { ackId: data.payload.ackId, success: true } } });
    socketIo.emitTmx({ data: mutation('c'), durable: true }); // answered: not queued
    await settle();

    expect(socketIo.queuedMessageCount()).toBe(2);
    expect(fake.rows.size).toBe(2); // and a reload would keep them

    fake.posted.length = 0;
    fake.down();
    fake.up();
    await settle();
    expect(postedMethods()).toEqual(['a', 'b']);
    expect(fake.resumed).toBeGreaterThan(0);
  });
});

describe('socketIo connection lifecycle over a MessageTransport', () => {
  let socketIo: SocketIo;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    fake.reset();
    vi.resetModules();
    socketIo = await importSocketIo();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
  });

  it('routes a server exception to the session guard and warns only when it is not an auth failure', () => {
    socketIo.connectSocket();
    fake.authException.mockReturnValueOnce(true);
    fake.handlers.exception({ message: 'token expired' });
    expect(warn).not.toHaveBeenCalled();

    fake.handlers.exception({ message: 'something else' });
    expect(fake.authException).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('[socket] server exception:', { message: 'something else' });
  });

  it('disconnectSocket closes the transport and drops it a second later', () => {
    vi.useFakeTimers();
    socketIo.connectSocket();
    expect(socketIo.socketExists()).toBe(true);

    socketIo.disconnectSocket();
    expect(fake.connection.disconnect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(socketIo.socketExists()).toBe(false);
  });

  it('reconnectSocket re-handshakes an existing transport, or opens one', () => {
    socketIo.reconnectSocket();
    expect(socketIo.socketExists()).toBe(true);
    expect(fake.connection.reconnect).not.toHaveBeenCalled();

    socketIo.reconnectSocket();
    expect(fake.connection.reconnect).toHaveBeenCalledTimes(1);
  });

  it('ensureConnected is a no-op when connected, re-opens a dropped transport, and opens a missing one', () => {
    expect(socketIo.ensureConnected()).toBe(true); // none yet: opens one
    expect(socketIo.socketExists()).toBe(true);

    fake.up();
    expect(socketIo.ensureConnected()).toBe(false);

    fake.down();
    expect(socketIo.ensureConnected()).toBe(true);
    expect(fake.connection.connect).toHaveBeenCalledTimes(1);
  });

  it('leaveTournamentRoom sends a leave, and the room is not re-joined on the next connect', () => {
    socketIo.connectSocket();
    fake.up();
    socketIo.joinTournamentRoom('t1');
    socketIo.leaveTournamentRoom('t1');
    expect(fake.sent).toContainEqual({ event: 'leaveTournament', data: { tournamentId: 't1' } });

    fake.down();
    fake.sent.length = 0;
    fake.up();
    expect(fake.sent.some((m: any) => m.event === 'joinTournament')).toBe(false);
  });

  it('leaveTournamentRoom sends nothing while disconnected (the connect handler owns membership)', () => {
    socketIo.connectSocket();
    socketIo.leaveTournamentRoom('t1');
    expect(fake.sent).toHaveLength(0);
    expect(socketIo.queuedMessageCount()).toBe(0);
  });
});
