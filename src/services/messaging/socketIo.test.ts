import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('services/session/sessionGuard', () => ({ handleSocketException: vi.fn(() => false) }));
vi.mock('services/authentication/loginState', () => ({ getLoginState: () => ({ email: 'td@x.com' }) }));
vi.mock('services/authentication/tokenManagement', () => ({ getToken: () => 'tok' }));
vi.mock('services/processDirective', () => ({ processDirective: vi.fn() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('services/chat/chatService', () => ({
  setChatSendFn: vi.fn(),
  setChatGapFn: vi.fn(),
  receiveMessage: vi.fn(),
  receiveAccepted: vi.fn(),
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
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({ socketPath: 'http://server' }) } }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({ socketLog: false }) } }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

describe('socketIo over a MessageTransport', () => {
  let socketIo: typeof import('./socketIo');
  let clientIdentity: typeof import('./clientIdentity');
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    fake.reset();
    vi.resetModules();
    socketIo = await import('./socketIo');
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
