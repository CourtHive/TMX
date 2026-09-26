/**
 * Which gesture a rest row gets, and — the part that matters — which one it must
 * NOT get.
 *
 * The two rows are indistinguishable by shape: a pending row carries a populated
 * `participantName` exactly like a person's row does, and both carry a
 * `fromMatchUpId`. So neither field can be used on its own to tell them apart, and
 * a rule written on either one alone breaks a working feature:
 *
 *   - branch on `participantName` first and a pending row drives the grid search
 *     with `R16: Brik/Michel vs Carrasco/De L' Herbe`, which no cell carries —
 *     the silent no-op the whole change exists to remove;
 *   - branch on `fromMatchUpId` and EVERY row locates, so a person's row stops
 *     searching for them — rest is measured from a matchUp, so that field is set
 *     on ordinary rows too.
 *
 * Both are asserted below as controls rather than left to reasoning.
 */
import { restRowActivation } from './restRowActivation';
import { describe, expect, it } from 'vitest';

// constants and types
import type { RestDailyLoad, RestRow } from './participantRest';

const FEEDER_ID = 'mu-r16-brik-michel';
const FEEDER_LABEL = "R16: Brik/Michel vs Carrasco/De L' Herbe";
const PERSON = 'Caden-Chady Nassar';

/** The daily-load shape every row carries; irrelevant to this decision. */
const LOAD: RestDailyLoad = { singles: 0, doubles: 0, total: 0, ordinal: 0, atLimit: [] };

/** A row for a known participant, resting — the ordinary case. */
function personRow(overrides: Partial<RestRow> = {}): RestRow {
  return {
    participantId: 'p-nassar',
    participantName: PERSON,
    status: 'resting',
    requiredMinutes: 30,
    typeChange: false,
    restMinutes: 10,
    // Set deliberately: rest is always measured FROM a matchUp, so this field
    // being present must not be what decides the gesture.
    fromMatchUpId: 'mu-earlier-today',
    load: LOAD,
    ...overrides,
  };
}

/** A row for an undecided side — keyed by the match that decides it. */
function pendingRow(overrides: Partial<RestRow> = {}): RestRow {
  return {
    participantId: `pending:${FEEDER_ID}`,
    participantName: FEEDER_LABEL,
    status: 'onCourt',
    pendingUpstream: true,
    requiredMinutes: 30,
    typeChange: false,
    fromMatchUpId: FEEDER_ID,
    fromMatchUpLabel: FEEDER_LABEL,
    load: LOAD,
    ...overrides,
  };
}

describe('restRowActivation — a person is searched for, an undecided side is pointed at', () => {
  it('gives a person row the grid search, carrying the stored name', () => {
    expect(restRowActivation(personRow(), true)).toEqual({ kind: 'search', participantName: PERSON });
  });

  it('gives a pending row the feeder matchUp, not a search', () => {
    expect(restRowActivation(pendingRow(), true)).toEqual({ kind: 'locate', matchUpId: FEEDER_ID });
  });

  it('never hands the matchUp LABEL of a pending row to the grid search', () => {
    // The defect this replaces, stated as an assertion: the label is a populated
    // `participantName`, so a rule that reads that field first would search for it.
    const activation = restRowActivation(pendingRow(), true);
    expect(activation).not.toMatchObject({ kind: 'search' });
    expect(JSON.stringify(activation)).not.toContain(FEEDER_LABEL);
  });

  it('does NOT locate a person row, even though it has a fromMatchUpId', () => {
    // The control for the opposite mistake. Without it, "locate when
    // fromMatchUpId is set" passes every other test in this file and silently
    // removes the search from every ordinary row.
    const activation = restRowActivation(personRow({ fromMatchUpId: 'mu-earlier-today' }), true);
    expect(activation).toEqual({ kind: 'search', participantName: PERSON });
  });
});

describe('restRowActivation — a row with nowhere to point stays inert', () => {
  it('returns null for both kinds when the court grid is not on screen', () => {
    // The plan and profile views draw no grid. An affordance that silently does
    // nothing is worse than no affordance, so the row must not be offered at all.
    expect(restRowActivation(personRow(), false)).toBeNull();
    expect(restRowActivation(pendingRow(), false)).toBeNull();
  });

  it('returns null for a pending row with no feeder recorded', () => {
    // Nothing to point at, and falling through to the search branch would hand
    // the grid the matchUp label — the exact failure this rule prevents.
    expect(restRowActivation(pendingRow({ fromMatchUpId: undefined }), true)).toBeNull();
  });

  it('returns null for a person row with no name', () => {
    expect(restRowActivation(personRow({ participantName: '' }), true)).toBeNull();
  });
});
