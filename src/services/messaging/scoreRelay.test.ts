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
const { mockServerConfig } = vi.hoisted(() => ({
  mockServerConfig: { socketPath: 'http://localhost:8383' },
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

const DEV_SOCKET_PATH = 'http://localhost:8383';

// Import after mocks are set up
import {
  connectRelay,
  disconnectRelay,
  onTournamentScore,
  subscribeToMatchUp,
  unsubscribeFromMatchUp,
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

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:tournament', 'tid-002');
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

    expect(matchCallback).toHaveBeenCalledWith(
      expect.objectContaining({ matchUpId: MU_ID }),
    );
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
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:tournament', 'tid-008');
    // Active matchUp subscriptions are also re-emitted
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', 'mu-persist');
  });
});
