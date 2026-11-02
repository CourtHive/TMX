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
 * No stored value: no parameter is passed, and the factory default applies
 * (30 minutes, or a matchUp's average plus recovery when that is shorter).
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

/** The period length the operator sees: the stored one, else the default. */
export function effectivePeriodLength(tournamentRecord: any): number {
  return readStoredPeriodLength(tournamentRecord) ?? DEFAULT_PERIOD_LENGTH;
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
 * value is already stored, or it is the default and nothing is stored. Other
 * keys of the extension round-trip.
 */
export function periodLengthWriteMethod(tournamentRecord: any, periodLength: number): any {
  if (!isValidPeriodLength(periodLength)) return undefined;
  const stored = readStoredPeriodLength(tournamentRecord);
  if (stored === periodLength) return undefined;
  if (stored === undefined && periodLength === DEFAULT_PERIOD_LENGTH) return undefined;
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
 * The period to pass the timed scheduler: the one just chosen, else the stored one. The default chosen with nothing
 * stored passes none, so the factory default applies, exactly as it does before any choice is made.
 */
export function schedulerPeriodLength(tournamentRecord: any, chosen?: number): number | undefined {
  const stored = readStoredPeriodLength(tournamentRecord);
  if (!isValidPeriodLength(chosen)) return stored;
  if (stored === undefined && chosen === DEFAULT_PERIOD_LENGTH) return undefined;
  return chosen;
}
