/**
 * Type definitions for scoring modal V2
 */

export type SetScore = {
  side1Score?: number;
  side2Score?: number;
  side1TiebreakScore?: number;
  side2TiebreakScore?: number;
  winningSide?: number;
};

export type ScoreOutcome = {
  isValid: boolean;
  sets: SetScore[];
  scoreObject?: any; // Full score object from generateOutcomeFromScoreString
  winningSide?: number;
  matchUpStatus?: string;
  error?: string;
  matchUpFormat?: string;
  score?: string;
};

export type ScoringModalParams = {
  matchUp: any;
  callback: (outcome: any) => void;
};

export type ScoreChangeHandler = (outcome: ScoreOutcome) => void;

export type RenderScoreEntryParams = {
  matchUp: any;
  container: HTMLElement;
  onScoreChange: ScoreChangeHandler;
};
