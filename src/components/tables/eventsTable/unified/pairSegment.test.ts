import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { inheritedEntryStage, segmentToEntry } from './pairSegment';
import { describe, expect, it } from 'vitest';

import { ACCEPTED } from 'constants/tmxConstants';

const { QUALIFYING, MAIN } = drawDefinitionConstants;
const { DIRECT_ACCEPTANCE, ALTERNATE } = entryStatusConstants;

describe('segmentToEntry', () => {
  it('maps the three pairing segments the way modifyEntriesStatus does', () => {
    // The two mappings must agree: a pair created "as Accepted" and an entry *moved* to
    // Accepted have to land in the same segment, or the unified table sorts them apart.
    expect(segmentToEntry(ACCEPTED)).toEqual({ entryStatus: DIRECT_ACCEPTANCE, entryStage: MAIN });
    expect(segmentToEntry(QUALIFYING)).toEqual({ entryStatus: DIRECT_ACCEPTANCE, entryStage: QUALIFYING });
    expect(segmentToEntry(ALTERNATE)).toEqual({ entryStatus: ALTERNATE, entryStage: MAIN });
  });

  it('falls back to ALTERNATE for an unrecognized segment', () => {
    expect(segmentToEntry('NONSENSE')).toEqual({ entryStatus: ALTERNATE, entryStage: MAIN });
  });
});

describe('inheritedEntryStage', () => {
  const rows = (...stages: (string | undefined)[]) => stages.map((entryStage) => ({ entryStage }));

  it('inherits a unanimous stage when pairing as Accepted', () => {
    // Pairing two qualifying-stage draw entries must not demote the pair to MAIN.
    expect(inheritedEntryStage(rows(QUALIFYING, QUALIFYING), ACCEPTED)).toBe(QUALIFYING);
    expect(inheritedEntryStage(rows(MAIN, MAIN), ACCEPTED)).toBe(MAIN);
  });

  it('defers to the segment when stages disagree or are absent', () => {
    expect(inheritedEntryStage(rows(MAIN, QUALIFYING), ACCEPTED)).toBeUndefined();
    expect(inheritedEntryStage(rows(undefined, undefined), ACCEPTED)).toBeUndefined();
  });

  it('never overrides an explicitly chosen Alternate or Qualifying segment', () => {
    // Choosing a segment is a decision; only "Accepted" means "accepted where they already are".
    expect(inheritedEntryStage(rows(QUALIFYING, QUALIFYING), ALTERNATE)).toBeUndefined();
    expect(inheritedEntryStage(rows(MAIN, MAIN), QUALIFYING)).toBeUndefined();
  });
});
