/**
 * The tournament's scheduling period length: the slot grid, in minutes, that the
 * timed scheduler (`scheduleProfileRounds`) rounds start times to.
 *
 * The factory takes `periodLength` as a scheduler parameter and holds no setting
 * for it, so the operator's choice is stored on the tournament record (one
 * extension, written through `mutationRequest`) and passed explicitly on every
 * call of the timed scheduler. The server and every client therefore run the
 * scheduler with the same value.
 *
 * No stored value: no parameter is passed, and the factory resolves the period
 * itself: each draw's scheduling policy `defaultPeriodLength` (draw > event >
 * tournament), else 30 minutes. What the operator is shown with nothing stored
 * is therefore the policy's `defaultPeriodLength`, not a fixed 30: showing 30
 * while the factory used the policy's 60 is CAPABILITY-001 (2026-11-13 review).
 *
 * Pure: every function takes the tournament record or the value it needs.
 */
import { ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';

export const SCHEDULING_SETTINGS_EXTENSION_NAME = 'schedulingSettings';
export const PERIOD_LENGTH_CHOICES = [5, 10, 15, 20, 30, 60] as const;
export const DEFAULT_PERIOD_LENGTH = 30;

function settingsValue(tournamentRecord: any): Record<string, any> | undefined {
  const extensions: any[] = tournamentRecord?.extensions ?? [];
  const value = extensions.find((extension: any) => extension?.name === SCHEDULING_SETTINGS_EXTENSION_NAME)?.value;
  return value && typeof value === 'object' ? value : undefined;
}

export function isValidPeriodLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 24 * 60;
}

/** The stored period length, or undefined when none is stored (the factory default applies). */
export function readStoredPeriodLength(tournamentRecord: any): number | undefined {
  const periodLength = settingsValue(tournamentRecord)?.periodLength;
  return isValidPeriodLength(periodLength) ? periodLength : undefined;
}

/** A scheduling policy's `defaultPeriodLength` (the policy itself, not its `{ scheduling }` wrapper), or undefined. */
export function policyPeriodLength(schedulingPolicy?: Record<string, any> | null): number | undefined {
  const minutes = schedulingPolicy?.defaultPeriodLength;
  return isValidPeriodLength(minutes) ? minutes : undefined;
}

/** What the scheduler uses when no period is passed: the policy's `defaultPeriodLength`, else the factory's 30. */
function unstatedPeriodLength(policyDefault?: number): number {
  return isValidPeriodLength(policyDefault) ? policyDefault : DEFAULT_PERIOD_LENGTH;
}

/** The period length the operator sees: the stored one, else what the scheduler will use (the policy's, else 30). */
export function effectivePeriodLength(tournamentRecord: any, policyDefault?: number): number {
  return readStoredPeriodLength(tournamentRecord) ?? unstatedPeriodLength(policyDefault);
}

/** The choices to offer: the standard ones, plus a stored value outside them so it is never lost from view. */
export function periodLengthChoices(tournamentRecord: any): number[] {
  const stored = readStoredPeriodLength(tournamentRecord);
  const choices: number[] = [...PERIOD_LENGTH_CHOICES];
  if (stored !== undefined && !choices.includes(stored)) choices.push(stored);
  return choices.sort((a, b) => a - b);
}

/**
 * The method that stores `periodLength`, or undefined when nothing changes: the
 * value is already stored, or nothing is stored and it is what the scheduler
 * uses anyway (`policyDefault`, else 30). Other keys of the extension round-trip.
 */
export function periodLengthWriteMethod(tournamentRecord: any, periodLength: number, policyDefault?: number): any {
  if (!isValidPeriodLength(periodLength)) return undefined;
  const stored = readStoredPeriodLength(tournamentRecord);
  if (stored === periodLength) return undefined;
  if (stored === undefined && periodLength === unstatedPeriodLength(policyDefault)) return undefined;
  const value = { ...settingsValue(tournamentRecord), periodLength };
  return {
    method: ADD_TOURNAMENT_EXTENSION,
    params: {
      extension: { name: SCHEDULING_SETTINGS_EXTENSION_NAME, value },
      ...(tournamentRecord?.tournamentId && { tournamentId: tournamentRecord.tournamentId }),
    },
  };
}

/** The timed scheduler's params with `periodLength` added when one is set; the params are not mutated. */
export function withPeriodLength<T extends Record<string, any>>(params: T, periodLength?: number): T {
  return isValidPeriodLength(periodLength) ? { ...params, periodLength } : params;
}

/**
 * The period to pass the timed scheduler: the one just chosen, else the stored one. With nothing stored, a choice
 * equal to what the scheduler would use anyway (`policyDefault`, else 30) passes none, so each draw keeps its own
 * policy's period. Any other choice is passed, so the scheduler uses exactly what the operator chose: a 30 chosen
 * under a policy of 60 is sent, where it used to be dropped as "the default".
 */
export function schedulerPeriodLength(
  tournamentRecord: any,
  chosen?: number,
  policyDefault?: number,
): number | undefined {
  const stored = readStoredPeriodLength(tournamentRecord);
  if (!isValidPeriodLength(chosen)) return stored;
  if (stored === undefined && chosen === unstatedPeriodLength(policyDefault)) return undefined;
  return chosen;
}
