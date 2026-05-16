/**
 * Pure-helper coverage for the crowd trackers modal. The DOM-construction
 * code in `crowdTrackersModal.ts` is covered by Playwright e2e (TMX/e2e/);
 * happy-dom is explicitly NOT proposed per feedback_one_dom_test_layer_per_ecosystem.md.
 */

import { describe, expect, it } from 'vitest';
import type { CrowdScoringSession } from 'services/crowd/scoreRelayClient';
import {
  buildSecondaryLine,
  buildStatusMessage,
  decidePrimaryButtonLabel,
} from './crowdTrackersModalLogic';

function makeSession(overrides: Partial<CrowdScoringSession> = {}): CrowdScoringSession {
  return {
    sessionId: 'sess-1',
    matchUpId: 'mu-1',
    tournamentId: 'tour-1',
    userId: 'user-alice',
    clientId: 'client-fp',
    currentScore: {},
    pointHistory: [],
    trusted: false,
    status: 'active',
    version: 0,
    createdAt: '2026-05-16T00:00:00Z',
    updatedAt: '2026-05-16T00:00:00Z',
    ...overrides,
  } as CrowdScoringSession;
}

describe('crowdTrackersModalLogic — buildStatusMessage', () => {
  it('returns the empty-state copy for zero sessions', () => {
    expect(buildStatusMessage(0)).toBe('No active crowd trackers');
  });

  it('singularises for exactly one session', () => {
    expect(buildStatusMessage(1)).toBe('1 active tracker');
  });

  it('pluralises for many sessions', () => {
    expect(buildStatusMessage(7)).toBe('7 active trackers');
  });
});

describe('crowdTrackersModalLogic — decidePrimaryButtonLabel', () => {
  it('shows Demote for trusted sessions', () => {
    expect(decidePrimaryButtonLabel(makeSession({ trusted: true }))).toBe('Demote');
  });

  it('shows Promote for untrusted sessions', () => {
    expect(decidePrimaryButtonLabel(makeSession({ trusted: false }))).toBe('Promote');
  });
});

describe('crowdTrackersModalLogic — buildSecondaryLine', () => {
  it('includes point count, version, and a fixed-format updated time', () => {
    const session = makeSession({
      version: 5,
      pointHistory: [{ winner: 1, recordedAt: 'x' } as any, { winner: 2, recordedAt: 'y' } as any],
      updatedAt: '2026-05-16T14:23:45Z',
    });
    // Inject the formatter to make the assertion locale-independent.
    const line = buildSecondaryLine(session, (d) => d.toISOString().slice(11, 19));
    expect(line).toBe('2 pts · v5 · updated 14:23:45');
  });

  it('reports 0 pts when the history is empty', () => {
    const line = buildSecondaryLine(makeSession(), () => '00:00:00');
    expect(line).toBe('0 pts · v0 · updated 00:00:00');
  });
});
