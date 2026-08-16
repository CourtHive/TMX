/**
 * The groupings table renders a GROUP's role badge from `field: 'participantRole'`, so the mapper is
 * the load-bearing link between the record and the badge. It originally dropped the field, and the
 * badge silently rendered nothing for every group — the column was visible, the record carried COACH,
 * and the cell was empty. Nothing failed, because nothing asserted the row shape.
 *
 * This is a row-shape contract test, not a formatter test: it fails if the field stops surviving the
 * mapping, which is the failure mode that actually happened.
 */
import { mapTeamParticipant } from './mapTeamParticipant';
import { describe, expect, it } from 'vitest';

const makeGroup = (overrides: any = {}) => ({
  participantId: 'g1',
  participantName: 'Coaching Group',
  participantType: 'GROUP',
  participantRole: 'COACH',
  individualParticipantIds: ['i1', 'i2'],
  individualParticipants: [],
  events: [{ eventId: 'e1' }],
  ...overrides,
});

describe('mapTeamParticipant', () => {
  it('carries participantRole onto the row so the badge column can read it', () => {
    let result: any = mapTeamParticipant(makeGroup(), {});
    expect(result.participantRole).toBe('COACH');
  });

  it('leaves participantRole undefined when the record has none, rather than inventing one', () => {
    let result: any = mapTeamParticipant(makeGroup({ participantRole: undefined }), {});
    expect(result.participantRole).toBeUndefined();
  });

  it('still maps the fields the table already depended on', () => {
    let result: any = mapTeamParticipant(makeGroup(), {});
    expect(result.participantId).toBe('g1');
    expect(result.participantName).toBe('Coaching Group');
    expect(result.participantType).toBe('GROUP');
    expect(result.membersCount).toBe(2);
    expect(result.searchText).toBe('coaching group');
  });
});
