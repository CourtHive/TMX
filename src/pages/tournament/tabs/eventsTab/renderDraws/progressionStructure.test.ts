import { pickProgressionStructure } from './progressionStructure';
import { describe, expect, it } from 'vitest';

// Enriched-structure shapes mirroring getEventData().drawsData[i].structures[j]
// (verified against the factory: RR → finishingPosition WIN_RATIO, elimination → ROUND_OUTCOME).
const rrMain = { stage: 'MAIN', finishingPosition: 'WIN_RATIO', structureType: 'CONTAINER' };
const rrQualifying = { stage: 'QUALIFYING', finishingPosition: 'WIN_RATIO', structureType: 'CONTAINER' };
const seMain = { stage: 'MAIN', finishingPosition: 'ROUND_OUTCOME' };
const playOff = { stage: 'PLAY_OFF', finishingPosition: 'ROUND_OUTCOME' };
const consolation = { stage: 'CONSOLATION', finishingPosition: 'ROUND_OUTCOME' };

describe('pickProgressionStructure', () => {
  it('returns the MAIN single-elimination structure for a plain SE draw', () => {
    expect(pickProgressionStructure([seMain])).toBe(seMain);
  });

  it('picks the MAIN elimination structure over an RR qualifying structure', () => {
    // Qualifying RR → Main SE: must render the MAIN bracket, not the RR qualifying.
    expect(pickProgressionStructure([rrQualifying, seMain])).toBe(seMain);
  });

  it('picks the playoff bracket when MAIN is round-robin (RR + playoff)', () => {
    expect(pickProgressionStructure([rrMain, playOff])).toBe(playOff);
  });

  it('returns undefined for a pure round-robin draw (no elimination bracket)', () => {
    expect(pickProgressionStructure([rrMain])).toBeUndefined();
  });

  it('prefers MAIN over other elimination structures (e.g. consolation)', () => {
    expect(pickProgressionStructure([seMain, consolation])).toBe(seMain);
  });

  it('returns undefined for empty / missing input', () => {
    expect(pickProgressionStructure([])).toBeUndefined();
    expect(pickProgressionStructure(undefined)).toBeUndefined();
  });
});
