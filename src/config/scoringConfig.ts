/**
 * Scoreboard and match format configuration.
 */
export interface ScoreboardConfig {
  matchFormats: {
    categories: Record<string, any>;
    singles: string;
    doubles: string;
  };
  options: {
    bestof: number[];
    setsto: number[];
    tiebreaksto: number[];
    supertiebreakto: number[];
  };
  settings: {
    singles: MatchFormatSettings;
    doubles: MatchFormatSettings;
  };
}

export interface MatchFormatSettings {
  max_sets: number;
  sets_to_win: number;
  games_for_set: number;
  tiebreak_to: number;
  tiebreaks_at: number;
  supertiebreak_to: number;
  final_set_tiebreak: boolean;
  final_set_supertiebreak: boolean;
}

const defaults: ScoreboardConfig = {
  matchFormats: {
    categories: {},
    singles: 'SET3-S:6/TB7',
    doubles: 'SET3-S:6/TB7-F:TB10',
  },
  options: {
    bestof: [1, 3, 5],
    setsto: [4, 6, 8, 9],
    tiebreaksto: [5, 7, 12],
    supertiebreakto: [7, 10, 21],
  },
  settings: {
    singles: {
      max_sets: 3,
      sets_to_win: 2,
      games_for_set: 6,
      tiebreak_to: 7,
      tiebreaks_at: 6,
      supertiebreak_to: 10,
      final_set_tiebreak: true,
      final_set_supertiebreak: false,
    },
    doubles: {
      max_sets: 3,
      sets_to_win: 2,
      games_for_set: 6,
      tiebreak_to: 7,
      tiebreaks_at: 6,
      supertiebreak_to: 10,
      final_set_tiebreak: false,
      final_set_supertiebreak: true,
    },
  },
};

let current: ScoreboardConfig = JSON.parse(JSON.stringify(defaults));

export const scoringBoardConfig = {
  get: (): Readonly<ScoreboardConfig> => current,
  set: (partial: Partial<ScoreboardConfig>) => {
    current = { ...current, ...partial };
  },
  reset: () => {
    current = JSON.parse(JSON.stringify(defaults));
  },
} as const;
