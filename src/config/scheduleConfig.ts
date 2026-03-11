/**
 * Schedule display preferences.
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
  minCourtGridRows: number;
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
  minCourtGridRows: 10,
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
