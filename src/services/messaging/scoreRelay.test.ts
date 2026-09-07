/**
 * Unit tests for TMX's score relay client module.
 *
 * Verifies the subscription protocol, handler dispatch, and cleanup
 * without needing a live relay server. Uses vi.mock to intercept
 * socket.io-client and validate the correct events are emitted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Capture event handlers registered by the module
const handlers = new Map<string, Function>();

const mockSocket = {
  connected: true,
  on: vi.fn((event: string, handler: Function) => {
    handlers.set(event, handler);
  }),
  emit: vi.fn(),
  // Re-opens a manager that a disconnect stopped — what `ensureRelayConnected`
  // calls to recover a transport the browser killed while the page was frozen.
  // Fires `connect` like a real socket would: without that, a test could invoke
  // the connect handler by hand and pass even with recovery removed.
  connect: vi.fn(() => {
    mockSocket.connected = true;
    handlers.get('connect')?.();
  }),
  disconnect: vi.fn(() => {
    mockSocket.connected = false;
  }),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    handlers.clear();
    mockSocket.connected = true;
    mockSocket.on.mockImplementation((event: string, handler: Function) => {
      handlers.set(event, handler);
    });
    return mockSocket;
  }),
}));

// Mutable so individual tests can flip between dev (localhost) and prod hosts.
// `get: () => mockServerConfig` returns the live object, so mutating
// `mockServerConfig.socketPath` before a connect changes what the module reads.
const { mockServerConfig, mockCrowdScoringEnabled } = vi.hoisted(() => ({
  mockServerConfig: { socketPath: 'http://localhost:8383' },
  mockCrowdScoringEnabled: vi.fn(() => true),
}));

vi.mock('config/serverConfig', () => ({
  serverConfig: {
    get: () => mockServerConfig,
  },
}));

vi.mock('config/debugConfig', () => ({
  debugConfig: {
    get: () => ({ socketLog: false }),
  },
}));

vi.mock('services/apis/scoreRelayApi', () => ({
  isCrowdScoringEnabled: mockCrowdScoringEnabled,
}));

const DEV_SOCKET_PATH = 'http://localhost:8383';

// Relay-specific wire event; no factory constant exists for it.
const SUBSCRIBE_TOURNAMENT = 'subscribe:tournament';

// Import after mocks are set up
import {
  connectRelay,
  disconnectRelay,
  onTournamentScore,
  subscribeToMatchUp,
  unsubscribeFromMatchUp,
  ensureRelayConnected,
} from './scoreRelay';

/** Simulate the relay server emitting 'connect' to our socket. */
function triggerConnect() {
  const connectHandler = handlers.get('connect');
  if (connectHandler) connectHandler();
}

/** Simulate the relay server emitting a 'score' event. */
function triggerScore(data: any) {
  const scoreHandler = handlers.get('score');
  if (scoreHandler) scoreHandler(data);
}

describe('TMX scoreRelay client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    mockSocket.connected = false;
    mockCrowdScoringEnabled.mockReturnValue(true);
    disconnectRelay();
  });

  afterEach(() => {
    // Restore the default dev host so host-specific tests don't leak.
    mockServerConfig.socketPath = DEV_SOCKET_PATH;
  });

  it('connects to /live namespace on the relay URL', async () => {
    const { io } = await import('socket.io-client');

    connectRelay('tid-001');

    expect(io).toHaveBeenCalledWith(
      expect.stringContaining('/live'),
      expect.objectContaining({ transports: ['websocket'] }),
    );
  });

  it('does not create a socket when crowd scoring is disabled', async () => {
    const { io } = await import('socket.io-client');
    mockCrowdScoringEnabled.mockReturnValue(false);

    connectRelay('tid-disabled');

    expect(io).not.toHaveBeenCalled();
  });

  it('derives local dev relay URL with port 8384', async () => {
    const { io } = await import('socket.io-client');
    connectRelay('tid-url');

    const calledUrl = (io as any).mock.calls[0]?.[0];
    expect(calledUrl).toContain('8384');
    expect(calledUrl).toContain('/live');
  });

  it('dev host: connects with the default /socket.io/ transport path', async () => {
    const { io } = await import('socket.io-client');
    mockServerConfig.socketPath = DEV_SOCKET_PATH;
    connectRelay('tid-dev-path');

    const [url, opts] = (io as any).mock.calls[0];
    expect(url).toBe('http://localhost:8384/live');
    expect(opts.path).toBe('/socket.io/');
  });

  it('prod host: connects to /live with the /relay/socket.io/ transport path', async () => {
    // Regression: in prod nginx exposes the relay ONLY under /relay/. A
    // default-path handshake (or a `${host}/relay/live` URL, which socket.io
    // parses as the namespace `/relay/live` on the default path) lands on CFS
    // and fails with "Invalid namespace" — no live scores reach TMX.
    const { io } = await import('socket.io-client');
    mockServerConfig.socketPath = 'https://courthive.net';
    connectRelay('tid-prod-path');

    const [url, opts] = (io as any).mock.calls[0];
    expect(url).toBe('https://courthive.net/live');
    expect(url).not.toContain('/relay/live');
    expect(opts.path).toBe('/relay/socket.io/');
  });

  it('subscribes to tournament on connect', () => {
    connectRelay('tid-002');
    triggerConnect();

    expect(mockSocket.emit).toHaveBeenCalledWith(SUBSCRIBE_TOURNAMENT, 'tid-002');
  });

  it('dispatches tournament-level score handler on score event', () => {
    const handler = vi.fn();
    connectRelay('tid-003');
    onTournamentScore(handler);
    triggerConnect();

    const scoreData = {
      matchUpId: 'mu-001',
      tournamentId: 'tid-003',
      score: { scoreStringSide1: '6-4' },
    };
    triggerScore(scoreData);

    expect(handler).toHaveBeenCalledWith(scoreData);
  });

  it('dispatches per-matchUp callbacks on score event', () => {
    const MU_ID = 'mu-specific';
    const matchCallback = vi.fn();
    connectRelay('tid-004');
    triggerConnect();

    subscribeToMatchUp(MU_ID, matchCallback);
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', MU_ID);

    triggerScore({ matchUpId: MU_ID, score: { scoreStringSide1: '3-2' } });

    expect(matchCallback).toHaveBeenCalledWith(expect.objectContaining({ matchUpId: MU_ID }));
  });

  it('invokes both tournament handler and matchUp callback for same matchUp', () => {
    const tournamentHandler = vi.fn();
    const matchCallback = vi.fn();

    connectRelay('tid-both');
    onTournamentScore(tournamentHandler);
    triggerConnect();
    subscribeToMatchUp('mu-both', matchCallback);

    triggerScore({ matchUpId: 'mu-both', score: {} });

    expect(tournamentHandler).toHaveBeenCalled();
    expect(matchCallback).toHaveBeenCalled();
  });

  it('does not dispatch to unsubscribed matchUp callbacks', () => {
    const callback = vi.fn();
    connectRelay('tid-005');
    triggerConnect();

    subscribeToMatchUp('mu-temp', callback);
    unsubscribeFromMatchUp('mu-temp');

    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', 'mu-temp');

    triggerScore({ matchUpId: 'mu-temp', score: {} });

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not invoke matchUp callback for a different matchUpId', () => {
    const callback = vi.fn();
    connectRelay('tid-006');
    triggerConnect();

    subscribeToMatchUp('mu-target', callback);

    triggerScore({ matchUpId: 'mu-other', score: {} });

    expect(callback).not.toHaveBeenCalled();
  });

  it('disconnects and clears state', () => {
    connectRelay('tid-007');
    triggerConnect();

    onTournamentScore(vi.fn());
    subscribeToMatchUp('mu-clear', vi.fn());

    disconnectRelay();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('re-subscribes active matchUp subscriptions on reconnect', () => {
    connectRelay('tid-008');
    triggerConnect();

    subscribeToMatchUp('mu-persist', vi.fn());

    // Simulate disconnect + reconnect
    vi.clearAllMocks();
    triggerConnect();

    // On reconnect, tournament subscription is re-emitted
    expect(mockSocket.emit).toHaveBeenCalledWith(SUBSCRIBE_TOURNAMENT, 'tid-008');
    // Active matchUp subscriptions are also re-emitted
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', 'mu-persist');
  });

  describe('ensureRelayConnected — recovery after a frozen/dropped transport', () => {
    it('re-opens the existing socket when the transport died', () => {
      connectRelay('tid-recover');
      triggerConnect();

      // What a back-forward-cache freeze leaves behind: the socket object is
      // still there, its transport is not.
      mockSocket.connected = false;
      vi.clearAllMocks();

      expect(ensureRelayConnected()).toBe(true);
      expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    });

    it('re-issues the tournament AND matchUp subscriptions once the reconnect lands', () => {
      connectRelay('tid-resub');
      triggerConnect();
      subscribeToMatchUp('mu-resub', vi.fn());

      mockSocket.connected = false;
      vi.clearAllMocks();
      // No manual triggerConnect here — the mock's connect() fires `connect`, so
      // these assertions fail if recovery does not actually reconnect.
      ensureRelayConnected();

      expect(mockSocket.emit).toHaveBeenCalledWith(SUBSCRIBE_TOURNAMENT, 'tid-resub');
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', 'mu-resub');
    });

    it('is a no-op while the relay is connected', () => {
      connectRelay('tid-live');
      triggerConnect();
      mockSocket.connected = true;
      vi.clearAllMocks();

      expect(ensureRelayConnected()).toBe(false);
      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('is a no-op when no tournament subscription is active', () => {
      disconnectRelay();
      vi.clearAllMocks();

      expect(ensureRelayConnected()).toBe(false);
      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('does NOT route through connectRelay — that would clear matchUpCallbacks', () => {
      connectRelay('tid-nowipe');
      triggerConnect();
      const callback = vi.fn();
      subscribeToMatchUp('mu-nowipe', callback);

      mockSocket.connected = false;
      ensureRelayConnected();

      // If recovery had gone through connectRelay (which begins with
      // disconnectRelay, clearing matchUpCallbacks), this score would reach
      // nobody and the scoring dialog would silently stop updating.
      triggerScore({ matchUpId: 'mu-nowipe', score: '6-4' });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
