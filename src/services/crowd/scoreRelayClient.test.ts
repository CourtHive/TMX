import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub localStorage so config/localStorage.getJwtTokenStorageKey works at module load.
const memStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  clear: () => {
    for (const k of Object.keys(memStore)) delete memStore[k];
  },
});

vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
let mockConfigured = true;

vi.mock('services/apis/scoreRelayApi', () => ({
  scoreRelayApi: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
  isCrowdScoringEnabled: () => mockConfigured,
}));

import {
  cancelSession,
  demoteSession,
  getSessionsByMatchUpId,
  getSessionsByTournamentId,
  promoteSession,
} from './scoreRelayClient';

function makeSession(overrides: Record<string, any> = {}): any {
  return {
    sessionId: 'sess-1',
    matchUpId: 'mu-1',
    tournamentId: 'tour-1',
    userId: 'user-a',
    clientId: 'client-fp',
    currentScore: {},
    pointHistory: [],
    trusted: false,
    status: 'active',
    version: 0,
    createdAt: '2026-05-16T00:00:00Z',
    updatedAt: '2026-05-16T00:00:00Z',
    ...overrides,
  };
}

describe('scoreRelayClient — getSessionsByMatchUpId', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockConfigured = true;
  });

  it('hits the matchUp query with no flags by default', async () => {
    mockGet.mockResolvedValue({ data: { sessions: [makeSession()] } });
    let result: any = await getSessionsByMatchUpId({ matchUpId: 'mu-X' });
    expect(result).toHaveLength(1);
    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet.mock.calls[0][0]).toBe('/api/crowd-sessions?matchUpId=mu-X');
  });

  it('passes activeOnly when requested', async () => {
    mockGet.mockResolvedValue({ data: { sessions: [] } });
    await getSessionsByMatchUpId({ matchUpId: 'mu-X', activeOnly: true });
    expect(mockGet.mock.calls[0][0]).toBe('/api/crowd-sessions?matchUpId=mu-X&activeOnly=true');
  });

  it('returns empty when score-relay is not configured', async () => {
    mockConfigured = false;
    let result: any = await getSessionsByMatchUpId({ matchUpId: 'mu-X' });
    expect(result).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns empty array when the response has no sessions field', async () => {
    mockGet.mockResolvedValue({ data: {} });
    let result: any = await getSessionsByMatchUpId({ matchUpId: 'mu-X' });
    expect(result).toEqual([]);
  });
});

describe('scoreRelayClient — getSessionsByTournamentId', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockConfigured = true;
  });

  it('combines tournamentId with both filters', async () => {
    mockGet.mockResolvedValue({ data: { sessions: [] } });
    await getSessionsByTournamentId({ tournamentId: 'tour-Z', activeOnly: true, trustedOnly: true });
    expect(mockGet.mock.calls[0][0]).toBe(
      '/api/crowd-sessions?tournamentId=tour-Z&activeOnly=true&trustedOnly=true',
    );
  });

  it('passes silenceErrors through the axios config', async () => {
    mockGet.mockResolvedValue({ data: { sessions: [] } });
    await getSessionsByTournamentId({ tournamentId: 'tour-Z', silenceErrors: true });
    expect(mockGet.mock.calls[0][1]).toEqual({ silenceErrors: true });
  });
});

describe('scoreRelayClient — promote / demote / cancel', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockDelete.mockReset();
    mockConfigured = true;
  });

  it('promoteSession POSTs to the promote endpoint with URL-encoded id', async () => {
    mockPost.mockResolvedValue({ data: { session: makeSession({ trusted: true, trustedBy: 'td-bob' }) } });
    let result: any = await promoteSession('sess with spaces');
    expect(mockPost.mock.calls[0][0]).toBe('/api/crowd-sessions/sess%20with%20spaces/promote');
    expect(result.trusted).toBe(true);
    expect(result.trustedBy).toBe('td-bob');
  });

  it('demoteSession POSTs to the demote endpoint', async () => {
    mockPost.mockResolvedValue({ data: { session: makeSession({ trusted: false }) } });
    let result: any = await demoteSession('sess-1');
    expect(mockPost.mock.calls[0][0]).toBe('/api/crowd-sessions/sess-1/demote');
    expect(result.trusted).toBe(false);
  });

  it('cancelSession DELETEs the session', async () => {
    mockDelete.mockResolvedValue({ data: { session: makeSession({ status: 'cancelled-by-user' }) } });
    let result: any = await cancelSession('sess-1');
    expect(mockDelete.mock.calls[0][0]).toBe('/api/crowd-sessions/sess-1');
    expect(result.status).toBe('cancelled-by-user');
  });

  it('promoteSession returns undefined when score-relay is not configured', async () => {
    mockConfigured = false;
    let result: any = await promoteSession('sess-1');
    expect(result).toBeUndefined();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('propagates axios errors so callers can branch on status', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 404 } }));
    await expect(promoteSession('missing')).rejects.toMatchObject({ response: { status: 404 } });
  });
});
