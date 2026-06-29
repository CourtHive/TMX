/**
 * Typed wrapper over score-relay's slice-3 REST endpoints.
 *
 * Mapping (epixodic/score-relay 7c3e173):
 *   getSessionsByMatchUpId    → GET    /api/crowd-sessions?matchUpId=...
 *   getSessionsByTournamentId → GET    /api/crowd-sessions?tournamentId=...&activeOnly=...&trustedOnly=...
 *   promoteSession            → POST   /api/crowd-sessions/:sessionId/promote
 *   demoteSession             → POST   /api/crowd-sessions/:sessionId/demote
 *   cancelSession             → DELETE /api/crowd-sessions/:sessionId
 *
 * All endpoints require a Bearer JWT (set automatically by scoreRelayApi's
 * request interceptor). The client deliberately surfaces axios errors so
 * callers can branch on 401/404; the toast convention from baseApi already
 * fires on non-200 unless `{ silenceErrors: true }` is set.
 */

import { isScoreRelayConfigured, scoreRelayApi } from 'services/apis/scoreRelayApi';

/**
 * HiveID-or-admin attribution carried by the relay (score-relay migration
 * 002). `personId` is the canonical Person id of whoever submitted the points,
 * when known — TMX classifies it against the loaded tournament participants
 * (see `classifyScorer`). Undefined for anonymous / legacy sessions.
 */
export interface CrowdScorerAttribution {
  personId: string | null;
  displayName: string;
  audience: 'admin' | 'hiveid';
  /** Email-verified (hiveid `email_verified` claim). Only verified scorers are nominatable. */
  verified: boolean;
}

export interface CrowdScoringSession {
  sessionId: string;
  matchUpId: string;
  tournamentId: string;
  userId: string;
  clientId: string;
  formatHint?: string;
  currentScore: any;
  pointHistory: any[];
  trusted: boolean;
  trustedBy?: string;
  trustedAt?: string;
  status: 'active' | 'cancelled-by-user' | 'cancelled-by-inactivity' | 'cancelled-by-td-finalize';
  version: number;
  createdAt: string;
  updatedAt: string;
  crowdScoredBy?: CrowdScorerAttribution;
}

interface SessionListResponse {
  sessions: CrowdScoringSession[];
}

interface SessionResponse {
  session: CrowdScoringSession;
}

export interface GetByTournamentOptions {
  tournamentId: string;
  activeOnly?: boolean;
  trustedOnly?: boolean;
  silenceErrors?: boolean;
}

export interface GetByMatchUpOptions {
  matchUpId: string;
  activeOnly?: boolean;
  silenceErrors?: boolean;
}

function notConfigured<T>(empty: T): Promise<T> {
  console.warn('[scoreRelayClient] score-relay not configured — call ignored');
  return Promise.resolve(empty);
}

export async function getSessionsByMatchUpId(opts: GetByMatchUpOptions): Promise<CrowdScoringSession[]> {
  if (!isScoreRelayConfigured()) return notConfigured<CrowdScoringSession[]>([]);
  const params = new URLSearchParams({ matchUpId: opts.matchUpId });
  if (opts.activeOnly) params.set('activeOnly', 'true');
  const response = await scoreRelayApi.get(`/api/crowd-sessions?${params.toString()}`, {
    silenceErrors: opts.silenceErrors,
  });
  const data = response?.data as SessionListResponse | undefined;
  return data?.sessions ?? [];
}

export async function getSessionsByTournamentId(opts: GetByTournamentOptions): Promise<CrowdScoringSession[]> {
  if (!isScoreRelayConfigured()) return notConfigured<CrowdScoringSession[]>([]);
  const params = new URLSearchParams({ tournamentId: opts.tournamentId });
  if (opts.activeOnly) params.set('activeOnly', 'true');
  if (opts.trustedOnly) params.set('trustedOnly', 'true');
  const response = await scoreRelayApi.get(`/api/crowd-sessions?${params.toString()}`, {
    silenceErrors: opts.silenceErrors,
  });
  const data = response?.data as SessionListResponse | undefined;
  return data?.sessions ?? [];
}

export async function promoteSession(sessionId: string): Promise<CrowdScoringSession | undefined> {
  if (!isScoreRelayConfigured()) return notConfigured<CrowdScoringSession | undefined>(undefined);
  const response = await scoreRelayApi.post(`/api/crowd-sessions/${encodeURIComponent(sessionId)}/promote`);
  return (response?.data as SessionResponse | undefined)?.session;
}

export async function demoteSession(sessionId: string): Promise<CrowdScoringSession | undefined> {
  if (!isScoreRelayConfigured()) return notConfigured<CrowdScoringSession | undefined>(undefined);
  const response = await scoreRelayApi.post(`/api/crowd-sessions/${encodeURIComponent(sessionId)}/demote`);
  return (response?.data as SessionResponse | undefined)?.session;
}

export async function cancelSession(sessionId: string): Promise<CrowdScoringSession | undefined> {
  if (!isScoreRelayConfigured()) return notConfigured<CrowdScoringSession | undefined>(undefined);
  const response = await scoreRelayApi.delete(`/api/crowd-sessions/${encodeURIComponent(sessionId)}`);
  return (response?.data as SessionResponse | undefined)?.session;
}
