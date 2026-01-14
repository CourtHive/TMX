/**
 * Test using factory's generateOutcomeFromScoreString with preserveSideOrder: true
 * to replace custom winningSide calculation
 */
import { describe, it, expect } from 'vitest';
import { tournamentEngine } from 'tods-competition-factory';

describe('Factory generateOutcomeFromScoreString with preserveSideOrder', () => {
  describe('Aggregate scoring', () => {
    it('should preserve side order and calculate winningSide correctly', () => {
      const format = 'SET3X-S:T10A';
      const { outcome } = tournamentEngine.generateOutcomeFromScoreString({
        scoreString: '30-1 0-1 0-1',
        matchUpFormat: format,
        preserveSideOrder: true,
      });

      // Side order preserved
      expect(outcome.score.sets[0].side1Score).toBe(30);
      expect(outcome.score.sets[0].side2Score).toBe(1);
      
      // winningSide calculated correctly (aggregate: 30-3)
      expect(outcome.winningSide).toBe(1);
    });

    it('should handle aggregate tie resolved by TB1', () => {
      const format = 'SET3X-S:T10A-F:TB1';
      const { outcome } = tournamentEngine.generateOutcomeFromScoreString({
        scoreString: '30-25 25-30 [1-0]',
        matchUpFormat: format,
        preserveSideOrder: true,
      });

      // Side order preserved
      expect(outcome.score.sets[0].side1Score).toBe(30);
      expect(outcome.score.sets[0].side2Score).toBe(25);
      expect(outcome.score.sets[2].side1Score).toBe(1);
      expect(outcome.score.sets[2].side2Score).toBe(0);
      
      // winningSide from tiebreak (aggregate 55-55, TB 1-0)
      expect(outcome.winningSide).toBe(1);
    });
  });

  describe('Standard scoring', () => {
    it('should preserve side order for loser score first', () => {
      const format = 'SET3-S:6/TB7';
      const { outcome } = tournamentEngine.generateOutcomeFromScoreString({
        scoreString: '3-6 4-6',
        matchUpFormat: format,
        preserveSideOrder: true,
      });

      // Side order preserved (side 1 lost)
      expect(outcome.score.sets[0].side1Score).toBe(3);
      expect(outcome.score.sets[0].side2Score).toBe(6);
      expect(outcome.score.sets[1].side1Score).toBe(4);
      expect(outcome.score.sets[1].side2Score).toBe(6);
      
      // winningSide calculated correctly (side 2 won)
      expect(outcome.winningSide).toBe(2);
    });

    it('should preserve side order for winner score first', () => {
      const format = 'SET3-S:6/TB7';
      const { outcome } = tournamentEngine.generateOutcomeFromScoreString({
        scoreString: '6-3 6-4',
        matchUpFormat: format,
        preserveSideOrder: true,
      });

      // Side order preserved (side 1 won)
      expect(outcome.score.sets[0].side1Score).toBe(6);
      expect(outcome.score.sets[0].side2Score).toBe(3);
      
      // winningSide calculated correctly (side 1 won)
      expect(outcome.winningSide).toBe(1);
    });

    it('should handle split sets correctly', () => {
      const format = 'SET3-S:6/TB7';
      const { outcome } = tournamentEngine.generateOutcomeFromScoreString({
        scoreString: '6-3 4-6 6-4',
        matchUpFormat: format,
        preserveSideOrder: true,
      });

      // All side orders preserved
      expect(outcome.score.sets[0].side1Score).toBe(6);
      expect(outcome.score.sets[1].side1Score).toBe(4);
      expect(outcome.score.sets[2].side1Score).toBe(6);
      
      // winningSide calculated correctly (side 1 won 2-1)
      expect(outcome.winningSide).toBe(1);
    });
  });

  describe('Scorestring generation', () => {
    it('should generate correct scoreStringSide1 and scoreStringSide2', () => {
      const format = 'SET3-S:6/TB7';
      const { outcome } = tournamentEngine.generateOutcomeFromScoreString({
        scoreString: '3-6 4-6',
        matchUpFormat: format,
        preserveSideOrder: true,
      });

      // Side 1 perspective: what they scored
      expect(outcome.score.scoreStringSide1).toBe('3-6 4-6');
      // Side 2 perspective: what they scored
      expect(outcome.score.scoreStringSide2).toBe('6-3 6-4');
    });

    it('should generate scoreStrings for aggregate format', () => {
      const format = 'SET3X-S:T10A';
      const { outcome } = tournamentEngine.generateOutcomeFromScoreString({
        scoreString: '30-1 0-1 0-1',
        matchUpFormat: format,
        preserveSideOrder: true,
      });

      expect(outcome.score.scoreStringSide1).toBe('30-1 0-1 0-1');
      expect(outcome.score.scoreStringSide2).toBe('1-30 1-0 1-0');
    });
  });
});
