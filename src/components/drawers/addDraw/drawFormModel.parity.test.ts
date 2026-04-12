/**
 * Parity test: ensure `drawFormModel`'s entry filtering matches the factory's
 * `validateAndDeriveDrawValues.getFilteredEntries` for every mode.
 *
 * The factory's filter is:
 *
 *   entries.filter((entry) =>
 *     entry.entryStatus &&
 *     [...STRUCTURE_SELECTED_STATUSES, QUALIFIER].includes(entry.entryStatus),
 *   )
 *
 * followed by a stage filter (`!entryStage || entryStage === MAIN`) inside
 * `getConsideredEntries`. `QUALIFIER` is already a member of
 * `STRUCTURE_SELECTED_STATUSES` (entryStatusConstants.ts:40), so the spread is
 * a no-op — it documents intent.
 *
 * `getFilteredEntries` is not exported by the factory's public surface, so
 * this test replicates the filter inline using the same canonical constant
 * the model imports. Parity is established by both implementations consuming
 * `STRUCTURE_SELECTED_STATUSES` from `entryStatusConstants`. If the factory
 * ever revises the membership rule beyond a status whitelist, this test will
 * silently start asserting the new rule on both sides — at which point a
 * future Phase B/C touch should evolve the model alongside it.
 *
 * Per the debate-note correction, fixtures must exercise:
 *   - every status in STRUCTURE_SELECTED_STATUSES (inclusion)
 *   - ALTERNATE / REGISTERED / WITHDRAWN (exclusion)
 *   - both MAIN and QUALIFYING entry stages
 */

import { describe, expect, it } from 'vitest';

// constants and types
import { entryStatusConstants } from 'tods-competition-factory';
import { drawFormModel, DrawFormMode } from './drawFormModel';

const { STRUCTURE_SELECTED_STATUSES, ALTERNATE, REGISTERED, WITHDRAWN } = entryStatusConstants;
const SELECTED_STATUS_SET: Set<string> = new Set<string>(STRUCTURE_SELECTED_STATUSES);

const STAGE_MAIN = 'MAIN';
const STAGE_QUALIFYING = 'QUALIFYING';

/* ─── Canonical filter (mirrors validateAndDeriveDrawValues.ts:99-109) ───── */

function canonicalFilter(entries: any[], stage: 'MAIN' | 'QUALIFYING'): any[] {
  const statusFiltered = entries.filter((entry) => entry?.entryStatus && SELECTED_STATUS_SET.has(entry.entryStatus));
  return statusFiltered.filter((entry) => {
    const entryStage = entry?.entryStage;
    return stage === 'MAIN' ? !entryStage || entryStage === STAGE_MAIN : entryStage === STAGE_QUALIFYING;
  });
}

/* ─── Fixture builders ──────────────────────────────────────────────────── */

/**
 * Build an event whose `entries` array contains:
 *   - one entry per status in STRUCTURE_SELECTED_STATUSES tagged for the
 *     requested stage
 *   - three excluded statuses (ALTERNATE, REGISTERED, WITHDRAWN) on the same
 *     stage to prove they are filtered out
 *   - one cross-stage entry to prove the stage gate works (DIRECT_ACCEPTANCE
 *     on the OTHER stage)
 */
function makeMixedEvent({
  primaryStage = STAGE_MAIN,
  eventType,
}: { primaryStage?: 'MAIN' | 'QUALIFYING'; eventType?: string } = {}): any {
  const otherStage = primaryStage === STAGE_MAIN ? STAGE_QUALIFYING : STAGE_MAIN;
  const entries: any[] = [];
  let id = 0;
  const next = () => `p${++id}`;

  // Inclusion: every member of STRUCTURE_SELECTED_STATUSES on the primary stage.
  for (const entryStatus of STRUCTURE_SELECTED_STATUSES) {
    entries.push({ participantId: next(), entryStage: primaryStage, entryStatus });
  }
  // One MAIN entry with NO entryStage (factory treats undefined as MAIN).
  if (primaryStage === STAGE_MAIN) {
    entries.push({ participantId: next(), entryStatus: 'DIRECT_ACCEPTANCE' });
  }
  // Exclusion: statuses outside the whitelist on the primary stage.
  for (const entryStatus of [ALTERNATE, REGISTERED, WITHDRAWN]) {
    entries.push({ participantId: next(), entryStage: primaryStage, entryStatus });
  }
  // Cross-stage: a DIRECT_ACCEPTANCE on the OTHER stage that must NOT show up.
  entries.push({ participantId: next(), entryStage: otherStage, entryStatus: 'DIRECT_ACCEPTANCE' });

  return { eventType, entries };
}

function expectParity(modelEntries: any[], event: any, stage: 'MAIN' | 'QUALIFYING') {
  const expected = canonicalFilter(event.entries, stage);
  const byString = (a: string, b: string) => a.localeCompare(b);
  const actualIds = modelEntries.map((e: any) => e.participantId as string).sort(byString);
  const expectedIds = expected.map((e: any) => e.participantId as string).sort(byString);
  expect(actualIds).toEqual(expectedIds);
  // Sanity: every included entryStatus must be in STRUCTURE_SELECTED_STATUSES.
  for (const entry of modelEntries) {
    expect(SELECTED_STATUS_SET.has(entry.entryStatus)).toBe(true);
  }
}

/* ─── Per-mode parity smoke cases ──────────────────────────────────────── */

describe('drawFormModel — entry-filter parity with factory STRUCTURE_SELECTED_STATUSES', () => {
  it('NEW_MAIN: drawEntries == canonicalFilter(MAIN)', () => {
    const event = makeMixedEvent({ primaryStage: STAGE_MAIN });
    const view = drawFormModel({ kind: 'NEW_MAIN', event }, {});
    expectParity(view.derivedValues.drawEntries, event, STAGE_MAIN);
    // STRUCTURE_SELECTED_STATUSES has 8 members + 1 untagged MAIN entry = 9.
    expect(view.derivedValues.drawEntries).toHaveLength(STRUCTURE_SELECTED_STATUSES.length + 1);
  });

  it('NEW_MAIN_WITH_QUALIFYING_FIRST: drawEntries == canonicalFilter(QUALIFYING)', () => {
    const event = makeMixedEvent({ primaryStage: STAGE_QUALIFYING });
    const view = drawFormModel({ kind: 'NEW_MAIN_WITH_QUALIFYING_FIRST', event }, {});
    expectParity(view.derivedValues.drawEntries, event, STAGE_QUALIFYING);
    expect(view.derivedValues.drawEntries).toHaveLength(STRUCTURE_SELECTED_STATUSES.length);
  });

  it('NEW_QUALIFYING: drawEntries == canonicalFilter(QUALIFYING)', () => {
    const event = makeMixedEvent({ primaryStage: STAGE_QUALIFYING });
    const view = drawFormModel({ kind: 'NEW_QUALIFYING', event }, {});
    expectParity(view.derivedValues.drawEntries, event, STAGE_QUALIFYING);
  });

  it('POPULATE_MAIN with no flight profile falls through to event.entries (MAIN)', () => {
    const event = makeMixedEvent({ primaryStage: STAGE_MAIN });
    const draw = {
      drawId: 'D1',
      drawName: 'Draw 1',
      structures: [{ structureId: 'S1', stage: STAGE_MAIN, stageSequence: 1 }],
      links: [],
    };
    const view = drawFormModel({ kind: 'POPULATE_MAIN', event, draw }, {});
    expectParity(view.derivedValues.drawEntries, event, STAGE_MAIN);
  });

  it('POPULATE_MAIN with a flight profile reads filtered flight entries', () => {
    // Flight provides its own MAIN drawEntries. The mixed flight has both
    // included and excluded statuses to verify the filter still applies.
    const flightDrawEntries: any[] = [];
    let id = 0;
    const next = () => `f${++id}`;
    for (const entryStatus of STRUCTURE_SELECTED_STATUSES) {
      flightDrawEntries.push({ participantId: next(), entryStage: STAGE_MAIN, entryStatus });
    }
    flightDrawEntries.push(
      { participantId: next(), entryStage: STAGE_MAIN, entryStatus: ALTERNATE },
      { participantId: next(), entryStage: STAGE_MAIN, entryStatus: WITHDRAWN },
    );

    const event: any = {
      entries: [],
      extensions: [
        {
          name: 'flightProfile',
          value: { flights: [{ drawId: 'D1', drawEntries: flightDrawEntries }] },
        },
      ],
    };
    const draw = {
      drawId: 'D1',
      drawName: 'Draw 1',
      structures: [{ structureId: 'S1', stage: STAGE_MAIN, stageSequence: 1 }],
      links: [],
    };
    const view = drawFormModel({ kind: 'POPULATE_MAIN', event, draw }, {});
    expectParity(view.derivedValues.drawEntries, { entries: flightDrawEntries }, STAGE_MAIN);
  });

  it('GENERATE_QUALIFYING: drawEntries == canonicalFilter(QUALIFYING) (delegates to NEW_QUALIFYING)', () => {
    const event = makeMixedEvent({ primaryStage: STAGE_QUALIFYING });
    const draw = { drawId: 'D1', structures: [], links: [] };
    const view = drawFormModel({ kind: 'GENERATE_QUALIFYING', event, draw }, {});
    expectParity(view.derivedValues.drawEntries, event, STAGE_QUALIFYING);
  });

  it('ATTACH_QUALIFYING: drawEntries == canonicalFilter(MAIN)', () => {
    const event = makeMixedEvent({ primaryStage: STAGE_MAIN });
    const structure: any = {
      structureId: 'S1',
      positionAssignments: Array.from({ length: 4 }, (_, i) => ({ drawPosition: i + 1, qualifier: i < 2 })),
    };
    const mode: DrawFormMode = { kind: 'ATTACH_QUALIFYING', event, draw: { drawId: 'D1' }, structure };
    const view = drawFormModel(mode, {});
    expectParity(view.derivedValues.drawEntries, event, STAGE_MAIN);
  });
});

/* ─── Sanity guards on the canonical constant itself ───────────────────── */

describe('drawFormModel — STRUCTURE_SELECTED_STATUSES canonical membership', () => {
  it('includes all 8 statuses from the factory entryStatusConstants', () => {
    // If the factory adds or removes a status, this test will fail and
    // alert the next session that the model fixtures + adapter need
    // re-checking. Update the count when intentional.
    expect(STRUCTURE_SELECTED_STATUSES.length).toBe(8);
    expect(SELECTED_STATUS_SET.has('CONFIRMED')).toBe(true);
    expect(SELECTED_STATUS_SET.has('DIRECT_ACCEPTANCE')).toBe(true);
    expect(SELECTED_STATUS_SET.has('JUNIOR_EXEMPT')).toBe(true);
    expect(SELECTED_STATUS_SET.has('LUCKY_LOSER')).toBe(true);
    expect(SELECTED_STATUS_SET.has('QUALIFIER')).toBe(true);
    expect(SELECTED_STATUS_SET.has('ORGANISER_ACCEPTANCE')).toBe(true);
    expect(SELECTED_STATUS_SET.has('SPECIAL_EXEMPT')).toBe(true);
    expect(SELECTED_STATUS_SET.has('WILDCARD')).toBe(true);
  });

  it('excludes ALTERNATE / REGISTERED / WITHDRAWN', () => {
    expect(SELECTED_STATUS_SET.has(ALTERNATE)).toBe(false);
    expect(SELECTED_STATUS_SET.has(REGISTERED)).toBe(false);
    expect(SELECTED_STATUS_SET.has(WITHDRAWN)).toBe(false);
  });
});
