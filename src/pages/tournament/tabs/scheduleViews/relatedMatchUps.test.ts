import { relatedMatchUpIds } from './relatedMatchUps';
import { describe, expect, it } from 'vitest';

// constants and types
import type { RestResult, RestRow } from './participantRest';
import type { ReadinessResult } from './matchUpReadiness';

const LOAD = { singles: 1, doubles: 0, total: 1, ordinal: 2, atLimit: [] };

function restRow(overrides: Partial<RestRow>): RestRow {
  return {
    participantId: 'p1',
    participantName: 'Alice',
    status: 'rested',
    requiredMinutes: 60,
    typeChange: false,
    load: LOAD,
    ...overrides,
  } as RestRow;
}

const rest = (rows: RestRow[]): RestResult => ({ evaluated: true, asOfMinutes: 800, rows });
const readiness = (findings: any[]): ReadinessResult => ({ evaluated: true, findings });

const NO_READINESS: ReadinessResult = { evaluated: false, reason: 'noTime' };
const NO_REST: RestResult = { evaluated: false, reason: 'noParticipants' };

describe('relatedMatchUpIds', () => {
  it('collects the matchUps every readiness finding names', () => {
    const result = relatedMatchUpIds(
      readiness([
        { kind: 'dependency', severity: 'WARN', matchUpIds: ['qf'] },
        { kind: 'recovery', severity: 'WARN', matchUpIds: ['earlier'] },
      ]),
      NO_REST,
    );
    expect(result).toEqual(['qf', 'earlier']);
  });

  it('adds where each player has just come from', () => {
    const result = relatedMatchUpIds(NO_READINESS, rest([restRow({ fromMatchUpId: 'r1' })]));
    expect(result).toEqual(['r1']);
  });

  it('puts readiness blockers before rest sources — a blocker is the stronger relation', () => {
    const result = relatedMatchUpIds(
      readiness([{ kind: 'dependency', severity: 'WARN', matchUpIds: ['qf'] }]),
      rest([restRow({ fromMatchUpId: 'r1' })]),
    );
    expect(result).toEqual(['qf', 'r1']);
  });

  it('dedupes a matchUp that is both a blocker and a rest source', () => {
    const result = relatedMatchUpIds(
      readiness([{ kind: 'recovery', severity: 'WARN', matchUpIds: ['earlier'] }]),
      rest([restRow({ fromMatchUpId: 'earlier' })]),
    );
    expect(result).toEqual(['earlier']);
  });

  it('returns nothing when neither side could be evaluated', () => {
    expect(relatedMatchUpIds(NO_READINESS, NO_REST)).toEqual([]);
  });

  it('returns nothing for a clean matchUp whose players have not played — the card lights nothing up', () => {
    expect(relatedMatchUpIds(readiness([]), rest([restRow({ status: 'none' })]))).toEqual([]);
  });

  it('ignores a finding that names no matchUp', () => {
    expect(relatedMatchUpIds(readiness([{ kind: 'recovery', severity: 'WARN' }]), NO_REST)).toEqual([]);
  });
});
