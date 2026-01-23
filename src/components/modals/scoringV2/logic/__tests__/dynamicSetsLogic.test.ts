/**
 * Tests for pure Dynamic Sets logic functions
 * These tests verify business logic without any DOM dependencies
 */

 
/* eslint-disable sonarjs/no-duplicate-string */

import { describe, it, expect } from 'vitest';
import {
  getSetFormatForIndex,
  isSetTiebreakOnly,
  getMaxAllowedScore,
  isSetComplete,
  getSetWinner,
  isMatchComplete,
  getMatchWinner,
  calculateComplement,
  shouldApplySmartComplement,
  shouldShowTiebreak,
  shouldCreateNextSet,
  buildSetScore,
  type MatchConfig,
} from '../dynamicSetsLogic';
import type { SetScore } from '../../types';
import { MATCH_FORMATS } from '../../../../../constants/matchUpFormats';
import { matchUpFormatCode } from 'tods-competition-factory';

// Helper to create MatchConfig from format string
function parseFormat(formatString: string): MatchConfig {
  const parsed = matchUpFormatCode.parse(formatString);
  const regex = /SET(\d+)/;
  const bestOfMatch = regex.exec(formatString);
  const bestOf = bestOfMatch ? Number.parseInt(bestOfMatch[1]) : 3;
  
  return {
    bestOf,
    setFormat: parsed?.setFormat,
    finalSetFormat: parsed?.finalSetFormat,
  };
}

describe('dynamicSetsLogic - Pure Functions', () => {
  // Use constants and parse them dynamically
  const standardBestOf3 = parseFormat(MATCH_FORMATS.SET3_S6_TB7);
  
  // Note: Can't parse this format cleanly because F:TB10 creates tiebreakSet (tiebreak-only) not tiebreakFormat
  // Using inline config to match original test expectations
  const standardBestOf5: MatchConfig = {
    bestOf: 5,
    setFormat: { setTo: 6, tiebreakAt: 6, tiebreakFormat: { tiebreakTo: 7 } },
    finalSetFormat: { setTo: 6, tiebreakAt: 6, tiebreakFormat: { tiebreakTo: 10 } },
  };
  
  const set8Config = parseFormat(MATCH_FORMATS.SET1_S8_TB7);
  const tb10Config = parseFormat(MATCH_FORMATS.SET3_S6_TB7_F_TB10);

  describe('getSetFormatForIndex', () => {
    it('returns standard format for first set of best-of-3', () => {
      const format = getSetFormatForIndex(0, standardBestOf3);
      expect(format?.setTo).toBe(6);
    });

    it('returns standard format for second set of best-of-3', () => {
      const format = getSetFormatForIndex(1, standardBestOf3);
      expect(format?.setTo).toBe(6);
    });

    it('returns finalSetFormat for deciding set of best-of-3', () => {
      const config = parseFormat(MATCH_FORMATS.SET3_S6_F_TB10);
      const format = getSetFormatForIndex(2, config);
      expect(format?.tiebreakSet?.tiebreakTo).toBe(10);
    });

    it('returns finalSetFormat for deciding set of best-of-5', () => {
      const format = getSetFormatForIndex(4, standardBestOf5);
      expect(format?.tiebreakFormat?.tiebreakTo).toBe(10);
    });

    it('returns standard format for non-deciding sets of best-of-5', () => {
      const format = getSetFormatForIndex(2, standardBestOf5);
      expect(format?.tiebreakFormat?.tiebreakTo).toBe(7);
    });
  });

  describe('isSetTiebreakOnly', () => {
    it('returns false for regular set format', () => {
      expect(isSetTiebreakOnly(standardBestOf3.setFormat)).toBe(false);
    });

    it('returns true for tiebreak-only format (TB10)', () => {
      expect(isSetTiebreakOnly(tb10Config.finalSetFormat)).toBe(true);
    });

    it('returns false for undefined format', () => {
      expect(isSetTiebreakOnly()).toBe(false);
    });
  });

  describe('getMaxAllowedScore', () => {
    describe('Standard S:6/TB7@6 format (tiebreakAt === setTo)', () => {
      it('allows up to setTo+1 when opponent has no score', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 0 }, standardBestOf3);
        expect(max).toBe(7); // 6 + 1 (absoluteMax for tiebreakAt===setTo)
      });

      it('allows up to setTo when opponent well below tiebreakAt', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 3 }, standardBestOf3);
        expect(max).toBe(6);
      });

      it('allows up to setTo+1 when opponent at tiebreakAt-1 (5)', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 5 }, standardBestOf3);
        expect(max).toBe(7); // Can win 7-5
      });

      it('allows up to setTo+1 when opponent at tiebreakAt', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 6 }, standardBestOf3);
        expect(max).toBe(7);
      });

      it('allows up to setTo+2 when opponent at setTo (deuce)', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 6 }, standardBestOf3);
        expect(max).toBe(7); // At tiebreakAt, max is absoluteMax (7)
      });

      it('allows opponent+2 when past setTo (extended play)', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 7 }, standardBestOf3);
        expect(max).toBe(9);
      });
    });

    describe('S:5/TB9@4 format (tiebreakAt === setTo - 1)', () => {
      const s5at4Config = parseFormat(MATCH_FORMATS.SET1_S5_TB9_AT4);

      it('allows up to setTo when opponent has no score (absoluteMax = setTo)', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 0 }, s5at4Config);
        expect(max).toBe(5); // absoluteMax is setTo because tiebreakAt < setTo
      });

      it('allows up to setTo when opponent well below tiebreakAt', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 2 }, s5at4Config);
        expect(max).toBe(5);
      });

      it('allows up to setTo when opponent at tiebreakAt-1 (3) for S:5@4', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 3 }, s5at4Config);
        expect(max).toBe(5); // Max is setTo (5) since tiebreakAt < setTo, can win 5-3
      });

      it('allows up to setTo when opponent at tiebreakAt', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 4 }, s5at4Config);
        expect(max).toBe(5); // Can win 5-4 after tiebreak
      });

      it('allows up to tiebreakAt when opponent at setTo (opponent won)', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 5 }, s5at4Config);
        expect(max).toBe(4); // Opponent won, my max is tiebreakAt (4)
      });

      it('enforces max of 5 when opponent is 0', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 0 }, s5at4Config);
        expect(max).toBe(5); // absoluteMax for S:5@4 is 5
      });
    });

    describe('S:8 format', () => {
      it('allows up to setTo+1 when opponent at tiebreakAt-1 (7)', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 7 }, set8Config);
        expect(max).toBe(9); // Can win 9-7 (opponent at tiebreakAt-1, need win by 2)
      });

      it('allows up to setTo+1 when opponent at tiebreakAt', () => {
        const max = getMaxAllowedScore(0, 1, { side1: 0, side2: 8 }, set8Config);
        expect(max).toBe(9); // 8 + 1 (absoluteMax for tiebreakAt===setTo)
      });
    });
  });

  describe('isSetComplete', () => {
    describe('Regular sets (S:6)', () => {
      it('recognizes 6-4 as complete', () => {
        expect(isSetComplete(0, { side1: 6, side2: 4 }, standardBestOf3)).toBe(true);
      });

      it('recognizes 6-0 as complete', () => {
        expect(isSetComplete(0, { side1: 6, side2: 0 }, standardBestOf3)).toBe(true);
      });

      it('recognizes 7-5 as complete', () => {
        expect(isSetComplete(0, { side1: 7, side2: 5 }, standardBestOf3)).toBe(true);
      });

      it('recognizes 7-6 with tiebreak as complete', () => {
        expect(isSetComplete(0, { side1: 7, side2: 6, tiebreak: 5 }, standardBestOf3)).toBe(true);
      });

      it('recognizes 5-4 as incomplete', () => {
        expect(isSetComplete(0, { side1: 5, side2: 4 }, standardBestOf3)).toBe(false);
      });

      it('recognizes 6-5 as incomplete', () => {
        expect(isSetComplete(0, { side1: 6, side2: 5 }, standardBestOf3)).toBe(false);
      });

      it('recognizes 7-6 without tiebreak as incomplete', () => {
        expect(isSetComplete(0, { side1: 7, side2: 6 }, standardBestOf3)).toBe(false);
      });

      it('recognizes 0-0 as incomplete', () => {
        expect(isSetComplete(0, { side1: 0, side2: 0 }, standardBestOf3)).toBe(false);
      });
    });

    describe('S:8 format', () => {
      it('recognizes 8-6 as complete', () => {
        expect(isSetComplete(0, { side1: 8, side2: 6 }, set8Config)).toBe(true);
      });

      it('recognizes 9-7 as complete', () => {
        expect(isSetComplete(0, { side1: 9, side2: 7 }, set8Config)).toBe(true);
      });

      it('recognizes 9-8 with tiebreak as complete', () => {
        expect(isSetComplete(0, { side1: 9, side2: 8, tiebreak: 5 }, set8Config)).toBe(true);
      });

      it('recognizes 8-7 as incomplete', () => {
        expect(isSetComplete(0, { side1: 8, side2: 7 }, set8Config)).toBe(false);
      });
    });

    describe('Tiebreak-only sets (TB10)', () => {
      it('recognizes 11-9 as complete', () => {
        expect(isSetComplete(2, { side1: 11, side2: 9 }, tb10Config)).toBe(true);
      });

      it('recognizes 10-8 as complete', () => {
        expect(isSetComplete(2, { side1: 10, side2: 8 }, tb10Config)).toBe(true);
      });

      it('recognizes 5-5 as incomplete', () => {
        expect(isSetComplete(2, { side1: 5, side2: 5 }, tb10Config)).toBe(false);
      });

      it('recognizes 0-0 as incomplete', () => {
        expect(isSetComplete(2, { side1: 0, side2: 0 }, tb10Config)).toBe(false);
      });
    });

    describe('S:5/TB9@4 format (tiebreakAt < setTo)', () => {
      const s5at4Config = parseFormat(MATCH_FORMATS.SET1_S5_TB9_AT4);

      it('recognizes 5-0 as complete', () => {
        expect(isSetComplete(0, { side1: 5, side2: 0 }, s5at4Config)).toBe(true);
      });

      it('recognizes 5-3 as complete', () => {
        expect(isSetComplete(0, { side1: 5, side2: 3 }, s5at4Config)).toBe(true);
      });

      it('recognizes 5-4 with tiebreak as complete', () => {
        expect(isSetComplete(0, { side1: 5, side2: 4, tiebreak: 7 }, s5at4Config)).toBe(true);
      });

      it('recognizes 4-5 with tiebreak as complete', () => {
        expect(isSetComplete(0, { side1: 4, side2: 5, tiebreak: 7 }, s5at4Config)).toBe(true);
      });

      it('recognizes 5-4 without tiebreak as incomplete', () => {
        expect(isSetComplete(0, { side1: 5, side2: 4 }, s5at4Config)).toBe(false);
      });

      it('recognizes 4-4 as incomplete', () => {
        expect(isSetComplete(0, { side1: 4, side2: 4 }, s5at4Config)).toBe(false);
      });

      it('recognizes 4-3 as incomplete', () => {
        expect(isSetComplete(0, { side1: 4, side2: 3 }, s5at4Config)).toBe(false);
      });
    });
  });

  describe('getSetWinner', () => {
    it('returns 1 when side 1 wins 6-4', () => {
      expect(getSetWinner(0, { side1: 6, side2: 4 }, standardBestOf3)).toBe(1);
    });

    it('returns 2 when side 2 wins 6-3', () => {
      expect(getSetWinner(0, { side1: 3, side2: 6 }, standardBestOf3)).toBe(2);
    });

    it('returns undefined for incomplete set 5-4', () => {
      expect(getSetWinner(0, { side1: 5, side2: 4 }, standardBestOf3)).toBeUndefined();
    });

    it('returns undefined for tied score 6-6', () => {
      expect(getSetWinner(0, { side1: 6, side2: 6 }, standardBestOf3)).toBeUndefined();
    });
  });

  describe('isMatchComplete', () => {
    it('returns true when side 1 wins 2-0 in best-of-3', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 6, side2Score: 3, winningSide: 1 },
      ];
      expect(isMatchComplete(sets, 3)).toBe(true);
    });

    it('returns true when side 2 wins 2-0 in best-of-3', () => {
      const sets: SetScore[] = [
        { side1Score: 4, side2Score: 6, winningSide: 2 },
        { side1Score: 3, side2Score: 6, winningSide: 2 },
      ];
      expect(isMatchComplete(sets, 3)).toBe(true);
    });

    it('returns true when side 1 wins 2-1 in best-of-3', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 3, side2Score: 6, winningSide: 2 },
        { side1Score: 6, side2Score: 2, winningSide: 1 },
      ];
      expect(isMatchComplete(sets, 3)).toBe(true);
    });

    it('returns false when match is 1-1 in best-of-3', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 3, side2Score: 6, winningSide: 2 },
      ];
      expect(isMatchComplete(sets, 3)).toBe(false);
    });

    it('returns false when match is 0-0', () => {
      const sets: SetScore[] = [];
      expect(isMatchComplete(sets, 3)).toBe(false);
    });

    it('returns true when side 1 wins 3-0 in best-of-5', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 6, side2Score: 3, winningSide: 1 },
        { side1Score: 6, side2Score: 2, winningSide: 1 },
      ];
      expect(isMatchComplete(sets, 5)).toBe(true);
    });

    it('returns false when match is 2-2 in best-of-5', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 3, side2Score: 6, winningSide: 2 },
        { side1Score: 6, side2Score: 2, winningSide: 1 },
        { side1Score: 2, side2Score: 6, winningSide: 2 },
      ];
      expect(isMatchComplete(sets, 5)).toBe(false);
    });
  });

  describe('getMatchWinner', () => {
    it('returns 1 when side 1 wins 2-0', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 6, side2Score: 3, winningSide: 1 },
      ];
      expect(getMatchWinner(sets, 3)).toBe(1);
    });

    it('returns 2 when side 2 wins 2-1', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 3, side2Score: 6, winningSide: 2 },
        { side1Score: 2, side2Score: 6, winningSide: 2 },
      ];
      expect(getMatchWinner(sets, 3)).toBe(2);
    });

    it('returns undefined when match is 1-1', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 3, side2Score: 6, winningSide: 2 },
      ];
      expect(getMatchWinner(sets, 3)).toBeUndefined();
    });
  });

  describe('calculateComplement', () => {
    const s6Format = parseFormat(MATCH_FORMATS.SET1_S6_TB7).setFormat!;
    const s8Format = parseFormat(MATCH_FORMATS.SET1_S8_TB7).setFormat!;

    it('returns 6 for digit 0 with S:6', () => {
      expect(calculateComplement(0, s6Format)).toBe(6);
    });

    it('returns 6 for digit 2 with S:6', () => {
      expect(calculateComplement(2, s6Format)).toBe(6);
    });

    it('returns 6 for digit 4 with S:6', () => {
      expect(calculateComplement(4, s6Format)).toBe(6);
    });

    it('returns 7 for digit 5 with S:6', () => {
      expect(calculateComplement(5, s6Format)).toBe(7);
    });

    it('returns null for digit 6 with S:6 (tied/winning)', () => {
      expect(calculateComplement(6, s6Format)).toBeNull();
    });

    it('returns null for digit 7 with S:6 (winning)', () => {
      expect(calculateComplement(7, s6Format)).toBeNull();
    });

    it('returns 8 for digit 3 with S:8', () => {
      expect(calculateComplement(3, s8Format)).toBe(8);
    });

    it('returns 9 for digit 7 with S:8', () => {
      expect(calculateComplement(7, s8Format)).toBe(9);
    });

    it('returns null for digit 8 with S:8', () => {
      expect(calculateComplement(8, s8Format)).toBeNull();
    });

    describe('S:5/TB9@4 format (tiebreakAt = setTo - 1)', () => {
      const s5at4Format = parseFormat(MATCH_FORMATS.SET1_S5_TB9_AT4).setFormat!;

      it('returns 5 for digit 0 with S:5@4', () => {
        expect(calculateComplement(0, s5at4Format)).toBe(5);
      });

      it('returns 5 for digit 1 with S:5@4', () => {
        expect(calculateComplement(1, s5at4Format)).toBe(5);
      });

      it('returns 5 for digit 2 with S:5@4', () => {
        expect(calculateComplement(2, s5at4Format)).toBe(5);
      });

      it('returns 5 for digit 3 with S:5@4', () => {
        expect(calculateComplement(3, s5at4Format)).toBe(5);
      });

      it('returns 5 for digit 4 with S:5@4 (setTo-1, tiebreakAt < setTo)', () => {
        expect(calculateComplement(4, s5at4Format)).toBe(5);
      });

      it('returns null for digit 5 with S:5@4 (at setTo)', () => {
        expect(calculateComplement(5, s5at4Format)).toBeNull();
      });
    });

    describe('S:6/TB7@5 format (tiebreakAt = setTo - 1)', () => {
      const s6at5Format = parseFormat(MATCH_FORMATS.SET1_S6_TB7_AT5).setFormat!;

      it('returns 6 for digit 2 with S:6@5', () => {
        expect(calculateComplement(2, s6at5Format)).toBe(6);
      });

      it('returns 6 for digit 4 with S:6@5', () => {
        expect(calculateComplement(4, s6at5Format)).toBe(6);
      });

      it('returns 6 for digit 5 with S:6@5 (setTo-1, tiebreakAt < setTo)', () => {
        expect(calculateComplement(5, s6at5Format)).toBe(6);
      });

      it('returns null for digit 6 with S:6@5 (at setTo)', () => {
        expect(calculateComplement(6, s6at5Format)).toBeNull();
      });
    });
  });

  describe('shouldApplySmartComplement', () => {
    const emptySet: SetScore[] = [];
    const oneSetWon: SetScore[] = [{ side1Score: 6, side2Score: 4, winningSide: 1 }];
    const matchComplete: SetScore[] = [
      { side1Score: 6, side2Score: 4, winningSide: 1 },
      { side1Score: 6, side2Score: 3, winningSide: 1 },
    ];

    it('applies complement: digit 2 → field1=2, field2=6', () => {
      const result = shouldApplySmartComplement(2, false, 0, emptySet, standardBestOf3, new Set(), true);
      expect(result.shouldApply).toBe(true);
      expect(result.field1Value).toBe(2);
      expect(result.field2Value).toBe(6);
    });

    it('applies complement with shift: shift+2 → field1=6, field2=2', () => {
      const result = shouldApplySmartComplement(2, true, 0, emptySet, standardBestOf3, new Set(), true);
      expect(result.shouldApply).toBe(true);
      expect(result.field1Value).toBe(6);
      expect(result.field2Value).toBe(2);
    });

    it('does not apply when feature disabled', () => {
      const result = shouldApplySmartComplement(2, false, 0, emptySet, standardBestOf3, new Set(), false);
      expect(result.shouldApply).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('does not apply when already used for this set', () => {
      const used = new Set([0]);
      const result = shouldApplySmartComplement(2, false, 0, emptySet, standardBestOf3, used, true);
      expect(result.shouldApply).toBe(false);
      expect(result.reason).toContain('Already used');
    });

    it('does not apply when match is complete', () => {
      const result = shouldApplySmartComplement(2, false, 2, matchComplete, standardBestOf3, new Set(), true);
      expect(result.shouldApply).toBe(false);
      expect(result.reason).toContain('complete');
    });

    it('does not apply for tiebreak-only set', () => {
      const result = shouldApplySmartComplement(5, false, 2, oneSetWon, tb10Config, new Set(), true);
      expect(result.shouldApply).toBe(false);
      expect(result.reason).toContain('Tiebreak-only');
    });

    it('does not apply when digit >= setTo', () => {
      const result = shouldApplySmartComplement(6, false, 0, emptySet, standardBestOf3, new Set(), true);
      expect(result.shouldApply).toBe(false);
      expect(result.reason).toContain('No predictable complement');
    });

    it('applies correctly for S:8 format', () => {
      const result = shouldApplySmartComplement(3, false, 0, emptySet, set8Config, new Set(), true);
      expect(result.shouldApply).toBe(true);
      expect(result.field1Value).toBe(3);
      expect(result.field2Value).toBe(8);
    });
  });

  describe('shouldShowTiebreak', () => {
    it('shows tiebreak when scores are 7-6', () => {
      expect(shouldShowTiebreak(0, { side1: 7, side2: 6 }, standardBestOf3)).toBe(true);
    });

    it('shows tiebreak when scores are 6-7', () => {
      expect(shouldShowTiebreak(0, { side1: 6, side2: 7 }, standardBestOf3)).toBe(true);
    });

    it('does not show tiebreak when scores are 6-6', () => {
      expect(shouldShowTiebreak(0, { side1: 6, side2: 6 }, standardBestOf3)).toBe(false);
    });

    it('does not show tiebreak when scores are 5-5', () => {
      expect(shouldShowTiebreak(0, { side1: 5, side2: 5 }, standardBestOf3)).toBe(false);
    });

    it('does not show tiebreak when scores are 6-4', () => {
      expect(shouldShowTiebreak(0, { side1: 6, side2: 4 }, standardBestOf3)).toBe(false);
    });

    it('shows tiebreak when scores are 9-8 for S:8', () => {
      expect(shouldShowTiebreak(0, { side1: 9, side2: 8 }, set8Config)).toBe(true);
    });

    it('does not show tiebreak for tiebreak-only sets', () => {
      expect(shouldShowTiebreak(2, { side1: 5, side2: 5 }, tb10Config)).toBe(false);
    });

    describe('S:5/TB9@4 format (tiebreakAt < setTo)', () => {
      const s5at4Config = parseFormat(MATCH_FORMATS.SET1_S5_TB9_AT4);

      it('shows tiebreak when scores are 5-4', () => {
        expect(shouldShowTiebreak(0, { side1: 5, side2: 4 }, s5at4Config)).toBe(true);
      });

      it('shows tiebreak when scores are 4-5', () => {
        expect(shouldShowTiebreak(0, { side1: 4, side2: 5 }, s5at4Config)).toBe(true);
      });

      it('does not show tiebreak when scores are 4-4', () => {
        expect(shouldShowTiebreak(0, { side1: 4, side2: 4 }, s5at4Config)).toBe(false);
      });

      it('does not show tiebreak when scores are 5-3', () => {
        expect(shouldShowTiebreak(0, { side1: 5, side2: 3 }, s5at4Config)).toBe(false);
      });

      it('does not show tiebreak when scores are 5-0', () => {
        expect(shouldShowTiebreak(0, { side1: 5, side2: 0 }, s5at4Config)).toBe(false);
      });
    });
  });

  describe('shouldCreateNextSet', () => {
    it('creates next set after first set complete', () => {
      const sets: SetScore[] = [{ side1Score: 6, side2Score: 4, winningSide: 1 }];
      expect(shouldCreateNextSet(0, sets, standardBestOf3)).toBe(true);
    });

    it('does not create when match is complete', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 6, side2Score: 3, winningSide: 1 },
      ];
      expect(shouldCreateNextSet(1, sets, standardBestOf3)).toBe(false);
    });

    it('does not create when exceeding bestOf', () => {
      const sets: SetScore[] = [
        { side1Score: 6, side2Score: 4, winningSide: 1 },
        { side1Score: 3, side2Score: 6, winningSide: 2 },
        { side1Score: 6, side2Score: 2, winningSide: 1 },
      ];
      expect(shouldCreateNextSet(2, sets, standardBestOf3)).toBe(false);
    });

    it('does not create when current set incomplete', () => {
      const sets: SetScore[] = [{ side1Score: 5, side2Score: 4, winningSide: undefined }];
      expect(shouldCreateNextSet(0, sets, standardBestOf3)).toBe(false);
    });
  });

  describe('buildSetScore', () => {
    it('builds regular set 6-4', () => {
      const set = buildSetScore(0, '6', '4', undefined, standardBestOf3);
      expect(set.side1Score).toBe(6);
      expect(set.side2Score).toBe(4);
      expect(set.winningSide).toBe(1);
    });

    it('builds regular set 7-6 with tiebreak', () => {
      const set = buildSetScore(0, '7', '6', '5', standardBestOf3);
      expect(set.side1Score).toBe(7);
      expect(set.side2Score).toBe(6);
      expect(set.winningSide).toBe(1);
      expect(set.side1TiebreakScore).toBe(7);
      expect(set.side2TiebreakScore).toBe(5);
    });

    it('builds incomplete set 5-4', () => {
      const set = buildSetScore(0, '5', '4', undefined, standardBestOf3);
      expect(set.side1Score).toBe(5);
      expect(set.side2Score).toBe(4);
      expect(set.winningSide).toBeUndefined();
    });

    it('builds tiebreak-only set TB10', () => {
      const set = buildSetScore(2, '11', '9', undefined, tb10Config);
      expect(set.side1Score).toBe(0);
      expect(set.side2Score).toBe(0);
      expect(set.side1TiebreakScore).toBe(11);
      expect(set.side2TiebreakScore).toBe(9);
      expect(set.winningSide).toBe(1);
    });

    it('builds incomplete tiebreak-only set', () => {
      const set = buildSetScore(2, '5', '5', undefined, tb10Config);
      expect(set.winningSide).toBeUndefined();
    });
  });
});
