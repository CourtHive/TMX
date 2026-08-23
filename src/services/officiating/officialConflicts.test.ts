/**
 * Pure-helper coverage for the official conflict surface. Picker DOM behaviour belongs in a Playwright
 * journey, not here (one DOM test layer per ecosystem).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getPolicyDefinitionsMock, getMatchUpOfficialConflictsMock } = vi.hoisted(() => ({
  getPolicyDefinitionsMock: vi.fn(),
  getMatchUpOfficialConflictsMock: vi.fn(),
}));

vi.mock('services/factory/engine', () => ({
  tournamentEngine: {
    getPolicyDefinitions: getPolicyDefinitionsMock,
    getMatchUpOfficialConflicts: getMatchUpOfficialConflictsMock,
  },
}));

import { evaluateCandidate, resolveConflictPolicy, summarizeConflicts } from './officialConflicts';
import { fixtures, policyConstants } from 'tods-competition-factory';

const { POLICY_TYPE_OFFICIATING_CONFLICT } = policyConstants;
const COACH_GROUPING = 'COACH grouping';
const { POLICY_OFFICIATING_CONFLICT_OF_INTEREST } = fixtures.policies;

beforeEach(() => {
  getPolicyDefinitionsMock.mockReset();
  getMatchUpOfficialConflictsMock.mockReset();
});

describe('resolveConflictPolicy', () => {
  it('prefers an attached provider policy', () => {
    const attached = { [POLICY_TYPE_OFFICIATING_CONFLICT]: { conflictRules: { SAME_PERSON: { enabled: true } } } };
    getPolicyDefinitionsMock.mockReturnValue({ policyDefinitions: attached });
    expect(resolveConflictPolicy()).toBe(attached);
  });

  it('falls back to the bundled default when none is attached', () => {
    getPolicyDefinitionsMock.mockReturnValue({ policyDefinitions: undefined });
    expect(resolveConflictPolicy()).toBe(POLICY_OFFICIATING_CONFLICT_OF_INTEREST);
  });

  it('falls back when the engine returns nothing at all', () => {
    getPolicyDefinitionsMock.mockReturnValue(undefined);
    expect(resolveConflictPolicy()).toBe(POLICY_OFFICIATING_CONFLICT_OF_INTEREST);
  });

  it('falls back when policyDefinitions exists but carries no conflict policy', () => {
    // A tournament with OTHER attached policies must not be read as "conflict checking configured off".
    getPolicyDefinitionsMock.mockReturnValue({ policyDefinitions: { scoring: {} } });
    expect(resolveConflictPolicy()).toBe(POLICY_OFFICIATING_CONFLICT_OF_INTEREST);
  });
});

describe('summarizeConflicts', () => {
  it('reports none for an empty conflict list', () => {
    expect(summarizeConflicts({ conflicts: [], blocked: false })).toEqual({ level: 'none', reasons: [] });
  });

  it('reports warn with reasons when not blocked', () => {
    const summary = summarizeConflicts({ conflicts: [{ reason: 'shares a grouping' }], blocked: false });
    expect(summary).toEqual({ level: 'warn', reasons: ['shares a grouping'] });
  });

  it('reports blocked when the factory says blocked', () => {
    const summary = summarizeConflicts({
      conflicts: [{ reason: COACH_GROUPING }, { reason: 'declared relationship' }],
      blocked: true,
    });
    expect(summary.level).toEqual('blocked');
    expect(summary.reasons).toEqual([COACH_GROUPING, 'declared relationship']);
  });

  it('drops conflicts that carry no reason rather than rendering blanks', () => {
    const summary = summarizeConflicts({ conflicts: [{ reason: 'real' }, {}], blocked: false });
    expect(summary.reasons).toEqual(['real']);
  });
});

describe('evaluateCandidate', () => {
  const args = {
    officialParticipantId: 'par-official',
    policyDefinitions: POLICY_OFFICIATING_CONFLICT_OF_INTEREST,
    matchUpId: 'm-1',
    drawId: 'd-1',
  };

  it('passes drawId + matchUpId + officialParticipantId to the engine', () => {
    getMatchUpOfficialConflictsMock.mockReturnValue({ conflicts: [], blocked: false });
    evaluateCandidate(args);
    expect(getMatchUpOfficialConflictsMock).toHaveBeenCalledWith(
      expect.objectContaining({ officialParticipantId: 'par-official', matchUpId: 'm-1', drawId: 'd-1' }),
    );
  });

  it('surfaces a blocking conflict', () => {
    getMatchUpOfficialConflictsMock.mockReturnValue({ conflicts: [{ reason: COACH_GROUPING }], blocked: true });
    expect(evaluateCandidate(args)).toEqual({ level: 'blocked', reasons: [COACH_GROUPING] });
  });

  it('fails OPEN when the engine errors — a UI that cannot evaluate must not invent a refusal', () => {
    // The factory gate on the mutation is the enforcement point; this is only an affordance. The
    // property this test is named for is UNCHANGED: an errored evaluation still does not block.
    //
    // What changed is that it no longer reports `none`. `none` means "assessed and clean", and
    // returning it for an evaluation that never ran made those two indistinguishable in the picker —
    // the failure the fail-soft rule exists to prevent. The level is now `unknown`, which the picker
    // renders as not-assessed while still allowing the selection.
    getMatchUpOfficialConflictsMock.mockReturnValue({ error: { code: 'ERR_MISSING_CONFLICT_SOURCE' } });
    const result = evaluateCandidate(args);
    expect(result.level).toEqual('unknown');
    // The fail-open property, asserted directly rather than implied by the label.
    expect(result.level).not.toEqual('blocked');
  });

  it('reports a clean evaluation as `none`, distinct from an unrunnable one', () => {
    // The control for the case above. Without this, `unknown` could have been made the return for
    // everything and the suite would not notice.
    getMatchUpOfficialConflictsMock.mockReturnValue({ conflicts: [] });
    expect(evaluateCandidate(args)).toEqual({ level: 'none', reasons: [] });
  });
});
