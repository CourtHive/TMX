import { describeDrawType, formatDrawTypeLabel } from './describeDrawType';
import { describe, expect, it } from 'vitest';

// Structure shapes mirror the factory (verified): RR → WIN_RATIO, elimination → ROUND_OUTCOME.
const rrMain = { stage: 'MAIN', finishingPosition: 'WIN_RATIO' };
const rrQualifying = { stage: 'QUALIFYING', finishingPosition: 'WIN_RATIO' };
const seMain = { stage: 'MAIN', finishingPosition: 'ROUND_OUTCOME' };
const seQualifying = { stage: 'QUALIFYING', finishingPosition: 'ROUND_OUTCOME' };
const playOff = { stage: 'PLAY_OFF', finishingPosition: 'ROUND_OUTCOME' };

describe('formatDrawTypeLabel', () => {
  it('title-cases a SNAKE_CASE draw type', () => {
    expect(formatDrawTypeLabel('SINGLE_ELIMINATION')).toBe('Single Elimination');
    expect(formatDrawTypeLabel('ROUND_ROBIN_WITH_PLAYOFF')).toBe('Round Robin With Playoff');
  });
  it('returns empty string for missing input', () => {
    expect(formatDrawTypeLabel(undefined)).toBe('');
  });
});

describe('describeDrawType', () => {
  it('labels a plain single-elimination draw', () => {
    expect(describeDrawType({ drawType: 'SINGLE_ELIMINATION', structures: [seMain] })).toBe('Single Elimination');
  });

  it('surfaces a round-robin qualifying under a single-elimination main', () => {
    // The reported bug: this used to read just "SINGLE_ELIMINATION".
    expect(describeDrawType({ drawType: 'SINGLE_ELIMINATION', structures: [rrQualifying, seMain] })).toBe(
      'Single Elimination (Round Robin Qualifying)',
    );
  });

  it('does not repeat the family for a same-type qualifying', () => {
    expect(describeDrawType({ drawType: 'SINGLE_ELIMINATION', structures: [seQualifying, seMain] })).toBe(
      'Single Elimination (Qualifying)',
    );
  });

  it('leaves named composite types (RR with playoff) un-annotated', () => {
    expect(describeDrawType({ drawType: 'ROUND_ROBIN_WITH_PLAYOFF', structures: [rrMain, playOff] })).toBe(
      'Round Robin With Playoff',
    );
  });

  it('handles missing drawType / structures', () => {
    expect(describeDrawType({})).toBe('');
    expect(describeDrawType({ drawType: 'ROUND_ROBIN' })).toBe('Round Robin');
  });
});
