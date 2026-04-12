import { describe, expect, it } from 'vitest';

// constants and types
import { drawFormModel, DrawFormInputs, DrawFormMode } from './drawFormModel';

import {
  AUTOMATED,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  GROUP_SIZE,
  PLAYOFF_TYPE,
  QUALIFIERS_COUNT,
  QUALIFYING_FIRST,
  QUALIFYING_POSITIONS,
  RATING_SCALE,
  ROUNDS_COUNT,
  SEEDING_POLICY,
  STRUCTURE_NAME,
} from 'constants/tmxConstants';

const SINGLE_ELIMINATION = 'SINGLE_ELIMINATION';
const ROUND_ROBIN = 'ROUND_ROBIN';
const ROUND_ROBIN_WITH_PLAYOFF = 'ROUND_ROBIN_WITH_PLAYOFF';
const AD_HOC = 'AD_HOC';
const SWISS = 'SWISS';
const DRAW_MATIC = 'DRAW_MATIC';

const STAGE_MAIN = 'MAIN';
const STAGE_QUALIFYING = 'QUALIFYING';
const ENTRY_DA = 'DIRECT_ACCEPTANCE';

/* ─── Fixtures ──────────────────────────────────────────────────────── */

function makeEntry(participantId: string, entryStage: string = STAGE_MAIN): any {
  return { participantId, entryStage, entryStatus: ENTRY_DA };
}

function makeEvent({
  mainCount = 0,
  qualifyingCount = 0,
  eventType,
}: { mainCount?: number; qualifyingCount?: number; eventType?: string } = {}): any {
  const entries: any[] = [];
  for (let i = 0; i < mainCount; i++) entries.push(makeEntry(`m${i}`, STAGE_MAIN));
  for (let i = 0; i < qualifyingCount; i++) entries.push(makeEntry(`q${i}`, STAGE_QUALIFYING));
  return { eventType, entries };
}

const EMPTY_INPUTS: DrawFormInputs = {};

/* ─── NEW_MAIN ──────────────────────────────────────────────────────── */

describe('drawFormModel — NEW_MAIN', () => {
  it('produces a single-elimination view sized to the next power of two', () => {
    const mode: DrawFormMode = { kind: 'NEW_MAIN', event: makeEvent({ mainCount: 12 }) };
    const view = drawFormModel(mode, EMPTY_INPUTS);

    expect(view.derivedValues.drawSize).toBe(16);
    expect(view.derivedValues.qualifiersCount).toBe(0);
    expect(view.derivedValues.drawEntries).toHaveLength(12);
    expect(view.derivedValues.qualifyingOnly).toBe(false);
    expect(view.fieldStates[DRAW_NAME]?.visible).toBe(true);
    expect(view.fieldStates[STRUCTURE_NAME]?.visible).toBe(false);
    expect(view.fieldStates[QUALIFYING_FIRST]?.visible).toBe(true);
    expect(view.fieldStates[QUALIFIERS_COUNT]?.visible).toBe(true);
    expect(view.fieldStates[QUALIFYING_POSITIONS]?.visible).toBe(false);
    expect(view.allowedDrawTypes).toContain(SINGLE_ELIMINATION);
    expect(view.availableSeedingPolicies).toContain('SEPARATE');
    expect(view.tieFormatRequired).toBe(false);
    expect(view.validationErrors).toEqual([]);
  });

  it('uses the raw entry count for ROUND_ROBIN draw type', () => {
    const mode: DrawFormMode = { kind: 'NEW_MAIN', event: makeEvent({ mainCount: 5 }) };
    const view = drawFormModel(mode, { [DRAW_TYPE]: ROUND_ROBIN });

    expect(view.derivedValues.drawSize).toBe(5);
    expect(view.fieldStates[GROUP_SIZE]?.visible).toBe(true);
    expect(view.fieldStates[PLAYOFF_TYPE]?.visible).toBe(false);
  });

  it('hides SEEDING_POLICY for AD_HOC draw types', () => {
    const mode: DrawFormMode = { kind: 'NEW_MAIN', event: makeEvent({ mainCount: 8 }) };
    const view = drawFormModel(mode, { [DRAW_TYPE]: DRAW_MATIC });

    expect(view.fieldStates[SEEDING_POLICY]?.visible).toBe(false);
    expect(view.availableSeedingPolicies).toEqual([]);
    expect(view.fieldStates[ROUNDS_COUNT]?.visible).toBe(true);
    expect(view.fieldStates[RATING_SCALE]?.visible).toBe(true);
  });

  it('marks tieFormatRequired for TEAM events', () => {
    const mode: DrawFormMode = { kind: 'NEW_MAIN', event: makeEvent({ mainCount: 4, eventType: 'TEAM' }) };
    const view = drawFormModel(mode, EMPTY_INPUTS);
    expect(view.tieFormatRequired).toBe(true);
  });

  it('infers a default qualifiersCount equal to the power-of-2 gap when QUALIFYING entries exist', () => {
    // 12 main entries → drawSize=16 → gap=4. Qualifying entries exist, so the
    // model should suggest 4 as the default qualifiers count.
    const mode: DrawFormMode = {
      kind: 'NEW_MAIN',
      event: makeEvent({ mainCount: 12, qualifyingCount: 6 }),
    };
    const view = drawFormModel(mode, EMPTY_INPUTS);
    expect(view.derivedValues.drawSize).toBe(16);
    expect(view.derivedValues.qualifiersCount).toBe(4);
    expect(view.fieldStates[QUALIFIERS_COUNT]?.value).toBe(4);
  });

  it('keeps the inferred qualifiersCount at 0 when no QUALIFYING entries exist', () => {
    const mode: DrawFormMode = { kind: 'NEW_MAIN', event: makeEvent({ mainCount: 12 }) };
    const view = drawFormModel(mode, EMPTY_INPUTS);
    expect(view.derivedValues.drawSize).toBe(16);
    expect(view.derivedValues.qualifiersCount).toBe(0);
  });

  it('honors a user-supplied QUALIFIERS_COUNT input over the inferred default', () => {
    const mode: DrawFormMode = {
      kind: 'NEW_MAIN',
      event: makeEvent({ mainCount: 12, qualifyingCount: 6 }),
    };
    const view = drawFormModel(mode, { [QUALIFIERS_COUNT]: 2 });
    expect(view.derivedValues.qualifiersCount).toBe(2);
  });
});

/* ─── NEW_MAIN_WITH_QUALIFYING_FIRST ────────────────────────────────── */

describe('drawFormModel — NEW_MAIN_WITH_QUALIFYING_FIRST', () => {
  it('shows STRUCTURE_NAME / QUALIFYING_POSITIONS and hides DRAW_NAME / SEEDING_POLICY', () => {
    const mode: DrawFormMode = {
      kind: 'NEW_MAIN_WITH_QUALIFYING_FIRST',
      event: makeEvent({ qualifyingCount: 6 }),
    };
    const view = drawFormModel(mode, EMPTY_INPUTS);

    expect(view.fieldStates[DRAW_NAME]?.visible).toBe(false);
    expect(view.fieldStates[STRUCTURE_NAME]?.visible).toBe(true);
    expect(view.fieldStates[STRUCTURE_NAME]?.value).toBe('Qualifying');
    expect(view.fieldStates[QUALIFYING_FIRST]?.value).toBe(true);
    expect(view.fieldStates[QUALIFIERS_COUNT]?.visible).toBe(false);
    expect(view.fieldStates[QUALIFYING_POSITIONS]?.visible).toBe(true);
    expect(view.fieldStates[SEEDING_POLICY]?.visible).toBe(false);
    expect(view.derivedValues.drawSize).toBe(6);
    expect(view.derivedValues.qualifyingOnly).toBe(true);
    expect(view.derivedValues.drawEntries).toHaveLength(6);
    expect(view.allowedDrawTypes).toEqual([SINGLE_ELIMINATION, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF]);
  });

  it('defaults draw size to 16 when no qualifying entries exist yet', () => {
    const mode: DrawFormMode = { kind: 'NEW_MAIN_WITH_QUALIFYING_FIRST', event: makeEvent() };
    const view = drawFormModel(mode, EMPTY_INPUTS);
    expect(view.derivedValues.drawSize).toBe(16);
    expect(view.derivedValues.drawEntries).toEqual([]);
  });

  it('honors a user-supplied QUALIFYING_POSITIONS input value', () => {
    const mode: DrawFormMode = {
      kind: 'NEW_MAIN_WITH_QUALIFYING_FIRST',
      event: makeEvent({ qualifyingCount: 8 }),
    };
    const view = drawFormModel(mode, { [QUALIFYING_POSITIONS]: 8 });
    expect(view.derivedValues.qualifiersCount).toBe(8);
    expect(view.fieldStates[QUALIFYING_POSITIONS]?.value).toBe(8);
  });
});

/* ─── NEW_QUALIFYING ────────────────────────────────────────────────── */

describe('drawFormModel — NEW_QUALIFYING', () => {
  it('uses qualifying entries and only allows qualifying draw types', () => {
    const mode: DrawFormMode = { kind: 'NEW_QUALIFYING', event: makeEvent({ qualifyingCount: 8 }) };
    const view = drawFormModel(mode, EMPTY_INPUTS);

    expect(view.derivedValues.drawSize).toBe(8);
    expect(view.derivedValues.drawEntries).toHaveLength(8);
    expect(view.derivedValues.qualifyingOnly).toBe(false);
    expect(view.allowedDrawTypes).toEqual([SINGLE_ELIMINATION, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF]);
    expect(view.fieldStates[STRUCTURE_NAME]?.visible).toBe(true);
    expect(view.fieldStates[DRAW_NAME]?.visible).toBe(false);
    expect(view.fieldStates[QUALIFYING_FIRST]?.visible).toBe(false);
  });

  it('produces zero draw size with no qualifying entries (validation error follows)', () => {
    const mode: DrawFormMode = { kind: 'NEW_QUALIFYING', event: makeEvent() };
    const view = drawFormModel(mode, EMPTY_INPUTS);
    expect(view.derivedValues.drawSize).toBe(0);
    expect(view.validationErrors[0]?.code).toBe('DRAW_SIZE_TOO_SMALL');
  });
});

/* ─── POPULATE_MAIN ─────────────────────────────────────────────────── */

describe('drawFormModel — POPULATE_MAIN', () => {
  it('uses the existing draw flight entries and pre-fills DRAW_NAME', () => {
    const event = makeEvent({ mainCount: 10 });
    const draw = {
      drawId: 'D1',
      drawName: 'Main Draw',
      structures: [{ structureId: 'S1', stage: STAGE_MAIN, stageSequence: 1 }],
      links: [],
    };
    const mode: DrawFormMode = { kind: 'POPULATE_MAIN', event, draw };
    const view = drawFormModel(mode, EMPTY_INPUTS);

    expect(view.derivedValues.drawSize).toBe(16);
    expect(view.derivedValues.drawEntries).toHaveLength(10);
    expect(view.fieldStates[DRAW_NAME]?.visible).toBe(true);
    expect(view.fieldStates[DRAW_NAME]?.value).toBe('Main Draw');
    expect(view.fieldStates[STRUCTURE_NAME]?.visible).toBe(false);
    expect(view.fieldStates[QUALIFYING_FIRST]?.visible).toBe(false);
  });

  it('infers qualifiersCount from an explicit qualifying-link source.qualifyingPositions', () => {
    const event = makeEvent({ mainCount: 8 });
    const draw = {
      drawId: 'D1',
      structures: [{ structureId: 'M', stage: STAGE_MAIN, stageSequence: 1 }],
      links: [{ target: { structureId: 'M' }, source: { qualifyingPositions: 4 } }],
    };
    const mode: DrawFormMode = { kind: 'POPULATE_MAIN', event, draw };
    const view = drawFormModel(mode, EMPTY_INPUTS);
    expect(view.derivedValues.qualifiersCount).toBe(4);
  });
});

/* ─── GENERATE_QUALIFYING ───────────────────────────────────────────── */

describe('drawFormModel — GENERATE_QUALIFYING', () => {
  it('treats the qualifying flow like NEW_QUALIFYING with the existing draw context', () => {
    const event = makeEvent({ qualifyingCount: 4 });
    const draw = { drawId: 'D1', structures: [], links: [] };
    const mode: DrawFormMode = { kind: 'GENERATE_QUALIFYING', event, draw };
    const view = drawFormModel(mode, EMPTY_INPUTS);

    expect(view.derivedValues.drawSize).toBe(4);
    expect(view.derivedValues.qualifyingOnly).toBe(false);
    expect(view.fieldStates[STRUCTURE_NAME]?.visible).toBe(true);
  });
});

/* ─── ATTACH_QUALIFYING ─────────────────────────────────────────────── */

describe('drawFormModel — ATTACH_QUALIFYING', () => {
  it('reads draw size from the target structure position assignments', () => {
    const event = makeEvent({ mainCount: 8 });
    const draw = { drawId: 'D1' };
    const structure = {
      structureId: 'S1',
      positionAssignments: [
        { drawPosition: 1, qualifier: true },
        { drawPosition: 2, qualifier: true },
        { drawPosition: 3 },
        { drawPosition: 4 },
      ],
    };
    const mode: DrawFormMode = { kind: 'ATTACH_QUALIFYING', event, draw, structure };
    const view = drawFormModel(mode, EMPTY_INPUTS);

    expect(view.derivedValues.drawSize).toBe(4);
    expect(view.derivedValues.qualifiersCount).toBe(2);
    expect(view.derivedValues.structurePositionAssignments).toHaveLength(4);
    expect(view.fieldStates[QUALIFIERS_COUNT]?.value).toBe(2);
    expect(view.fieldStates[AUTOMATED]?.disabled).toBe(true);
  });

  it('flags an empty target structure as a validation error', () => {
    const mode: DrawFormMode = {
      kind: 'ATTACH_QUALIFYING',
      event: makeEvent(),
      draw: { drawId: 'D1' },
      structure: { structureId: 'S1', positionAssignments: [] },
    };
    const view = drawFormModel(mode, EMPTY_INPUTS);
    expect(view.validationErrors.some((e) => e.code === 'ATTACH_DRAW_SIZE_MISSING')).toBe(true);
  });

  it('clamps a user-supplied QUALIFIERS_COUNT above maxQualifiers down to the cap', () => {
    const event = makeEvent({ mainCount: 8 });
    const structure = {
      structureId: 'S1',
      positionAssignments: Array.from({ length: 8 }, (_, i) => ({ drawPosition: i + 1 })),
    };
    const mode: DrawFormMode = { kind: 'ATTACH_QUALIFYING', event, draw: { drawId: 'D1' }, structure };
    const view = drawFormModel(mode, { [QUALIFIERS_COUNT]: 99 });

    expect(view.derivedValues.maxQualifiers).toBe(8);
    expect(view.derivedValues.qualifiersCount).toBe(8);
    expect(view.fieldStates[QUALIFIERS_COUNT]?.value).toBe(8);
  });

  it('floors a user-supplied QUALIFIERS_COUNT below 1 to 1', () => {
    const event = makeEvent({ mainCount: 4 });
    const structure = {
      structureId: 'S1',
      positionAssignments: Array.from({ length: 4 }, (_, i) => ({ drawPosition: i + 1 })),
    };
    const mode: DrawFormMode = { kind: 'ATTACH_QUALIFYING', event, draw: { drawId: 'D1' }, structure };
    const view = drawFormModel(mode, { [QUALIFIERS_COUNT]: 0 });

    expect(view.derivedValues.qualifiersCount).toBe(1);
  });

  it('honors an explicit mode.maxQualifiers override below the structure size', () => {
    const event = makeEvent({ mainCount: 8 });
    const structure = {
      structureId: 'S1',
      positionAssignments: Array.from({ length: 16 }, (_, i) => ({ drawPosition: i + 1 })),
    };
    const mode: DrawFormMode = {
      kind: 'ATTACH_QUALIFYING',
      event,
      draw: { drawId: 'D1' },
      structure,
      maxQualifiers: 4,
    };
    const view = drawFormModel(mode, { [QUALIFIERS_COUNT]: 10 });

    expect(view.derivedValues.maxQualifiers).toBe(4);
    expect(view.derivedValues.qualifiersCount).toBe(4);
  });
});

/* ─── Validation cases ──────────────────────────────────────────────── */

describe('drawFormModel — validation', () => {
  it('reports DRAW_SIZE_BELOW_REQUIRED when qualifiers + entries exceed draw size', () => {
    const mode: DrawFormMode = { kind: 'NEW_MAIN', event: makeEvent({ mainCount: 4 }) };
    const view = drawFormModel(mode, { [QUALIFIERS_COUNT]: 16 });

    const error = view.validationErrors.find((e) => e.code === 'DRAW_SIZE_BELOW_REQUIRED');
    expect(error).toBeDefined();
    expect(error?.field).toBe(DRAW_SIZE);
  });

  it('reports DRAW_SIZE_TOO_SMALL when there are zero entries', () => {
    const mode: DrawFormMode = { kind: 'NEW_QUALIFYING', event: makeEvent() };
    const view = drawFormModel(mode, EMPTY_INPUTS);
    expect(view.validationErrors[0]?.code).toBe('DRAW_SIZE_TOO_SMALL');
  });
});

/* ─── Critical transitions ──────────────────────────────────────────── */

describe('drawFormModel — critical transitions', () => {
  it('NEW_MAIN ↔ NEW_MAIN_WITH_QUALIFYING_FIRST toggle re-derives draw size from the right entry stage', () => {
    const event = makeEvent({ mainCount: 12, qualifyingCount: 6 });

    const newMain = drawFormModel({ kind: 'NEW_MAIN', event }, EMPTY_INPUTS);
    expect(newMain.derivedValues.drawSize).toBe(16); // nextPow2(12)
    expect(newMain.derivedValues.drawEntries).toHaveLength(12);
    expect(newMain.fieldStates[DRAW_NAME]?.visible).toBe(true);
    expect(newMain.fieldStates[STRUCTURE_NAME]?.visible).toBe(false);

    const qualifyingFirst = drawFormModel(
      { kind: 'NEW_MAIN_WITH_QUALIFYING_FIRST', event },
      EMPTY_INPUTS,
      { previousMode: { kind: 'NEW_MAIN', event } },
    );
    expect(qualifyingFirst.derivedValues.drawSize).toBe(6); // raw qualifying entry count
    expect(qualifyingFirst.derivedValues.drawEntries).toHaveLength(6);
    expect(qualifyingFirst.fieldStates[DRAW_NAME]?.visible).toBe(false);
    expect(qualifyingFirst.fieldStates[STRUCTURE_NAME]?.visible).toBe(true);
    expect(qualifyingFirst.derivedValues.qualifyingOnly).toBe(true);
  });

  it('NEW_QUALIFYING → ATTACH_QUALIFYING flips the draw-size source from entries to structure', () => {
    const event = makeEvent({ qualifyingCount: 10, mainCount: 32 });
    const newQualifying = drawFormModel({ kind: 'NEW_QUALIFYING', event }, EMPTY_INPUTS);
    expect(newQualifying.derivedValues.drawSize).toBe(10);

    const structure = {
      structureId: 'S1',
      positionAssignments: Array.from({ length: 8 }, (_, i) => ({
        drawPosition: i + 1,
        qualifier: i < 4,
      })),
    };
    const attaching = drawFormModel(
      { kind: 'ATTACH_QUALIFYING', event, draw: { drawId: 'D1' }, structure },
      EMPTY_INPUTS,
    );
    expect(attaching.derivedValues.drawSize).toBe(8);
    expect(attaching.derivedValues.qualifiersCount).toBe(4);
  });

  it('drawType change within a single mode recomputes field visibility and drawSize', () => {
    const event = makeEvent({ mainCount: 12 });

    const single = drawFormModel({ kind: 'NEW_MAIN', event }, { [DRAW_TYPE]: SINGLE_ELIMINATION });
    expect(single.derivedValues.drawSize).toBe(16);
    expect(single.fieldStates[GROUP_SIZE]?.visible).toBe(false);
    expect(single.fieldStates[PLAYOFF_TYPE]?.visible).toBe(false);

    const rrPlayoff = drawFormModel({ kind: 'NEW_MAIN', event }, { [DRAW_TYPE]: ROUND_ROBIN_WITH_PLAYOFF });
    expect(rrPlayoff.derivedValues.drawSize).toBe(12); // raw count, no power-of-2
    expect(rrPlayoff.fieldStates[GROUP_SIZE]?.visible).toBe(true);
    expect(rrPlayoff.fieldStates[PLAYOFF_TYPE]?.visible).toBe(true);

    const swiss = drawFormModel({ kind: 'NEW_MAIN', event }, { [DRAW_TYPE]: SWISS });
    expect(swiss.fieldStates[SEEDING_POLICY]?.visible).toBe(false);
    expect(swiss.fieldStates[AUTOMATED]?.visible).toBe(false);
    expect(swiss.fieldStates[RATING_SCALE]?.visible).toBe(true);
  });

  it('AD_HOC draw type hides QUALIFIERS_COUNT in NEW_MAIN', () => {
    const view = drawFormModel(
      { kind: 'NEW_MAIN', event: makeEvent({ mainCount: 6 }) },
      { [DRAW_TYPE]: AD_HOC },
    );
    expect(view.fieldStates[QUALIFIERS_COUNT]?.visible).toBe(false);
  });
});
