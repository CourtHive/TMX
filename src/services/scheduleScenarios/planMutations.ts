/**
 * Plan-mode drop translation (pure, DOM-free).
 *
 * In Plan mode a grid drop must NOT mutate the official schedule; it edits the
 * scenario. `buildGridDropMethods` still produces the normal
 * `addMatchUpScheduleItems` method array, and this helper folds those methods
 * into the scenario's `placements` (upsert by matchUpId, keeping each drop's
 * exact `schedule` so `getScenarioScheduleView` replays it identically — a
 * clearing drop clears, a placing drop places).
 */
import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';

export interface ScenarioPlacement {
  tournamentId: string;
  matchUpId: string;
  schedule: any;
}

export function foldMethodsIntoScenario(
  placements: ScenarioPlacement[],
  methods: Array<{ method: string; params: any }>,
  tournamentId: string,
): ScenarioPlacement[] {
  const byId = new Map<string, ScenarioPlacement>((placements ?? []).map((p) => [p.matchUpId, p]));

  for (const { method, params } of methods ?? []) {
    if (method !== ADD_MATCHUP_SCHEDULE_ITEMS) continue;
    const matchUpId = params?.matchUpId;
    if (!matchUpId) continue;
    byId.set(matchUpId, { tournamentId, matchUpId, schedule: params.schedule ?? {} });
  }

  return [...byId.values()];
}
