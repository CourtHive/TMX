/**
 * Pure-logic helpers behind `openPracticeCapacityModal`. Kept separate
 * from the DOM-building module so they can be unit-tested without
 * mounting the modal.
 */

import { tournamentEngine } from 'services/factory/engine';

export type ParsedCapacity =
  | { ok: true; value: number | null }
  | { ok: false; errorKey: string };

const ERR_INVALID = 'modals.practiceCapacity.invalidNumber';
const ERR_NEGATIVE = 'modals.practiceCapacity.mustBeNonNegative';

/**
 * Reads the current tournament-wide PRACTICE default capacity from the
 * live tournamentRecord. `null` / absent means unlimited.
 */
export function resolveCurrentPracticeDefaultCapacity(): number | null {
  const { tournamentRecord } = tournamentEngine.getTournament() || {};
  return resolveFromRecord(tournamentRecord);
}

export function resolveFromRecord(tournamentRecord: any): number | null {
  const raw = tournamentRecord?.scheduling?.practice?.defaultCapacity;
  if (raw === null || raw === undefined) return null;
  return raw;
}

/**
 * Validates and normalizes the form-state representation of the
 * capacity choice into the value expected by setPracticeDefaultCapacity.
 *   { mode: 'unlimited' } → `null`
 *   { mode: 'capped', capValue: '0' | positive integer string } → number
 *   anything else → { ok: false, errorKey }
 */
export function parseCapacityInput(state: { mode: 'unlimited' | 'capped'; capValue: string }): ParsedCapacity {
  if (state.mode === 'unlimited') return { ok: true, value: null };

  const trimmed = state.capValue.trim();
  if (!trimmed) return { ok: false, errorKey: ERR_INVALID };

  const num = Number(trimmed);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return { ok: false, errorKey: ERR_INVALID };
  }
  if (num < 0) return { ok: false, errorKey: ERR_NEGATIVE };

  return { ok: true, value: num };
}
