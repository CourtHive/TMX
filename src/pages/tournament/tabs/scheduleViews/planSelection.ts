/**
 * The scenario Plan mode shows, kept across its re-renders within a tab session. Its own module so that what opens a
 * plan (a recovery just saved, for one) can select it without importing Plan mode's view.
 */
let activePlanScenarioId: string | null = null;

export function getActivePlanScenarioId(): string | null {
  return activePlanScenarioId;
}

export function setActivePlanScenarioId(scenarioId: string | null): void {
  activePlanScenarioId = scenarioId;
}
