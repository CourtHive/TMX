/**
 * Unit tests for TMX's score relay client module.
 *
 * Verifies the subscription protocol, handler dispatch, and cleanup
 * without needing a live relay server. Uses vi.mock to intercept
 * socket.io-client and validate the correct events are emitted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('config/serverConfig', () => ({
  serverConfig: {
    get: () => ({ socketPath: 'http://localhost:8383' }),
  },
}));

vi.mock('config/debugConfig', () => ({
  debugConfig: {
    get: () => ({ socketLog: false }),
  },
}));

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
    const matchCallback = vi.fn();
    connectRelay('tid-004');
    triggerConnect();

    subscribeToMatchUp('mu-specific', matchCallback);
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', 'mu-specific');

    triggerScore({ matchUpId: 'mu-specific', score: { scoreStringSide1: '3-2' } });

    expect(matchCallback).toHaveBeenCalledWith(
      expect.objectContaining({ matchUpId: 'mu-specific' }),
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
