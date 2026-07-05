/**
 * Schedule display preferences.
 *
 * `minCourtGridRows` was removed in favour of an in-place stepper in the
 * court grid header that persists to the tournament's `scheduleDisplay`
 * extension. The hardcoded fallback for that path lives at
 * `scheduleViews/gridView.ts:DEFAULT_MIN_COURT_GRID_ROWS`.
 */
export interface ScheduleConfig {
  teams: boolean;
  clubs: boolean;
  time24: boolean;
  ioc_codes: boolean;
  default_time: string;
  scores_in_draw_order: boolean;
  completed_matches_in_search: boolean;
  max_matches_per_court: number;
  court_identifiers: boolean;
}

const defaults: ScheduleConfig = {
  teams: true,
  clubs: true,
  time24: true,
  ioc_codes: false,
  default_time: '9:00',
  scores_in_draw_order: true,
  completed_matches_in_search: false,
  max_matches_per_court: 14,
  court_identifiers: true,
};

let current: ScheduleConfig = { ...defaults };

export const scheduleConfig = {
  get: (): Readonly<ScheduleConfig> => current,
  set: (partial: Partial<ScheduleConfig>) => {
    current = { ...current, ...partial };
  },
  reset: () => {
    current = { ...defaults };
  },
} as const;
