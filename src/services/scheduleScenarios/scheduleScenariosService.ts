/**
 * Client service for schedule scenarios ("contingency plans").
 *
 * Reads call the factory engine directly (like `competitionScheduleMatchUps`);
 * writes go through `mutationRequest` per the ecosystem rule that all mutations
 * flow through the mutation path — never the engine directly. The factory owns
 * all scheduling logic (see factory `scheduleGovernor`); this layer only maps
 * TMX call sites to factory methods and unwraps results.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { competitionEngine } from 'services/factory/engine';

// constants and types
import { COMPETITION_ENGINE } from 'constants/tmxConstants';
import {
  REMOVE_SCHEDULE_SCENARIO,
  UPDATE_SCHEDULE_SCENARIO,
  REBASE_SCHEDULE_SCENARIO,
  APPLY_SCHEDULE_SCENARIO,
  ADD_SCHEDULE_SCENARIO,
} from 'constants/mutationConstants';

export interface ScenarioPlacement {
  tournamentId: string;
  matchUpId: string;
  schedule: any;
}

export interface ScheduleScenario {
  scenarioId: string;
  scenarioName: string;
  scheduledDates?: string[];
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  basedOnHash?: string;
  placements: ScenarioPlacement[];
}

// ── Reads (engine-direct) ──

export function listScheduleScenarios(tournamentId: string): ScheduleScenario[] {
  return competitionEngine.getScheduleScenarios({ tournamentId })?.scenarios ?? [];
}

export function getScenarioProjection(tournamentId: string, scenarioId: string, venueIds?: string[]): any {
  return competitionEngine.getScenarioScheduleProjection({ tournamentId, scenarioId, venueIds });
}

export function getScenarioStatus(tournamentId: string, scenarioId: string): any {
  return competitionEngine.getScheduleScenarioStatus({ tournamentId, scenarioId });
}

// ── Writes (mutation path) ──

function dispatch(method: string, params: Record<string, any>): Promise<any> {
  return new Promise((resolve) => {
    mutationRequest({ methods: [{ method, params }], engine: COMPETITION_ENGINE, callback: resolve });
  });
}

export function addScheduleScenario(
  tournamentId: string,
  scenario: Partial<ScheduleScenario> & { scenarioName: string },
): Promise<any> {
  return dispatch(ADD_SCHEDULE_SCENARIO, { tournamentId, scenario });
}

export function updateScheduleScenario(
  tournamentId: string,
  scenarioId: string,
  updates: Partial<ScheduleScenario>,
): Promise<any> {
  return dispatch(UPDATE_SCHEDULE_SCENARIO, { tournamentId, scenarioId, updates });
}

export function removeScheduleScenario(tournamentId: string, scenarioId: string): Promise<any> {
  return dispatch(REMOVE_SCHEDULE_SCENARIO, { tournamentId, scenarioId });
}

export function rebaseScheduleScenario(tournamentId: string, scenarioId: string): Promise<any> {
  return dispatch(REBASE_SCHEDULE_SCENARIO, { tournamentId, scenarioId });
}

export function applyScheduleScenario(
  tournamentId: string,
  scenarioId: string,
  options?: { removePriorValues?: boolean; scheduleCompletedMatchUps?: boolean },
): Promise<any> {
  return dispatch(APPLY_SCHEDULE_SCENARIO, { tournamentId, scenarioId, ...(options ?? {}) });
}
