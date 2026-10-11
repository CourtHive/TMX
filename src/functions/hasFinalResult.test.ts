import { hasFinalResult } from './hasFinalResult';
import { describe, expect, it } from 'vitest';

describe('hasFinalResult', () => {
  it('a completed tie (COMPLETED, no winner) has its result', () => {
    expect(hasFinalResult({ matchUpStatus: 'COMPLETED' })).toBe(true);
  });

  it('a winner is a result, whatever the status', () => {
    expect(hasFinalResult({ matchUpStatus: 'COMPLETED', winningSide: 1 })).toBe(true);
    expect(hasFinalResult({ matchUpStatus: 'WALKOVER', winningSide: 2 })).toBe(true);
  });

  it('control: no winner and not COMPLETED is not, as before', () => {
    for (const matchUpStatus of ['TO_BE_PLAYED', 'IN_PROGRESS', 'SUSPENDED', 'DOUBLE_WALKOVER', 'ABANDONED']) {
      expect(hasFinalResult({ matchUpStatus }), matchUpStatus).toBe(false);
    }
    expect(hasFinalResult(undefined)).toBe(false);
  });
});
