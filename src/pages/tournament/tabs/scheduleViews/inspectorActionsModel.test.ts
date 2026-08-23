import { buildInspectorActionModel } from './inspectorActionsModel';
import { describe, expect, it } from 'vitest';

// constants and types
import type { ReadinessMatchUp } from './matchUpReadiness';

const EVENT_ID = 'e-1';
const ALICE = 'p-alice';
const ALICE_NAME = 'Alice Smith';
const PAIR_1 = 'pair-1';
const SMITH_JONES = 'Smith/Jones';

function matchUp(overrides: Partial<ReadinessMatchUp> = {}): ReadinessMatchUp {
  return { matchUpId: 'm-1', eventId: EVENT_ID, roundName: 'R16', ...overrides };
}

describe('buildInspectorActionModel — who the popover can open', () => {
  it('returns undefined for a matchUp no longer in the tournament', () => {
    expect(buildInspectorActionModel('m-gone', [matchUp()])).toBeUndefined();
  });

  it('offers both singles players, by their own names', () => {
    const target = matchUp({
      sides: [
        { participantId: ALICE, participantName: ALICE_NAME },
        { participantId: 'p-bob', participantName: 'Bob Jones' },
      ],
    });
    const model = buildInspectorActionModel('m-1', [target]);
    expect(model?.participants).toEqual([
      { participantId: ALICE, participantName: ALICE_NAME },
      { participantId: 'p-bob', participantName: 'Bob Jones' },
    ]);
    expect(model?.eventId).toBe(EVENT_ID);
    expect(model?.label).toBe('R16: Alice Smith vs Bob Jones');
  });

  it('offers the four individuals of a doubles matchUp, never the pair name twice', () => {
    const target = matchUp({
      matchUpType: 'DOUBLES',
      sides: [
        {
          participantId: PAIR_1,
          participant: {
            participantId: PAIR_1,
            participantName: SMITH_JONES,
            individualParticipants: [
              { participantId: ALICE, participantName: ALICE_NAME },
              { participantId: 'p-bob', participantName: 'Bob Jones' },
            ],
          },
        },
        {
          participantId: 'pair-2',
          participant: {
            participantId: 'pair-2',
            participantName: 'Chen/Dana',
            individualParticipants: [
              { participantId: 'p-chen', participantName: 'Chen Wu' },
              { participantId: 'p-dana', participantName: 'Dana Reid' },
            ],
          },
        },
      ],
    });
    const model = buildInspectorActionModel('m-1', [target]);
    expect(model?.participants.map((p) => p.participantId)).toEqual([ALICE, 'p-bob', 'p-chen', 'p-dana']);
    expect(model?.participants.map((p) => p.participantName)).not.toContain(SMITH_JONES);
  });

  it('falls back to the side participant when a pair was not hydrated with its members', () => {
    const target = matchUp({
      sides: [{ participantId: PAIR_1, participant: { participantId: PAIR_1, participantName: SMITH_JONES } }],
    });
    expect(buildInspectorActionModel('m-1', [target])?.participants).toEqual([
      { participantId: PAIR_1, participantName: SMITH_JONES },
    ]);
  });

  it('offers nobody for a side that is still TBD, rather than a card that cannot open', () => {
    const target = matchUp({ sides: [{ participantId: ALICE, participantName: ALICE_NAME }, {}] });
    expect(buildInspectorActionModel('m-1', [target])?.participants).toEqual([
      { participantId: ALICE, participantName: ALICE_NAME },
    ]);
  });

  it('never offers the same individual twice', () => {
    const target = matchUp({
      sides: [
        {
          participantId: 'team-1',
          participant: {
            participantId: 'team-1',
            individualParticipants: [
              { participantId: ALICE, participantName: ALICE_NAME },
              { participantId: ALICE, participantName: ALICE_NAME },
            ],
          },
        },
      ],
    });
    expect(buildInspectorActionModel('m-1', [target])?.participants).toHaveLength(1);
  });
});

describe('buildInspectorActionModel — defensive fallbacks', () => {
  it('falls back to the id when a hydrated member carries no name, rather than rendering blank', () => {
    const target = matchUp({
      sides: [
        {
          participantId: PAIR_1,
          participant: { participantId: PAIR_1, individualParticipants: [{ participantId: ALICE }] },
        },
      ],
    });
    expect(buildInspectorActionModel('m-1', [target])?.participants).toEqual([
      { participantId: ALICE, participantName: ALICE },
    ]);
  });

  it('offers nobody for a matchUp with no sides at all', () => {
    expect(buildInspectorActionModel('m-1', [matchUp()])?.participants).toEqual([]);
  });
});
