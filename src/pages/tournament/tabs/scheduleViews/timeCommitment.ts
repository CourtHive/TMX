/**
 * Schedule2 — how strongly the schedule commits to a matchUp's written time.
 *
 * A `timeModifier` is not a note beside a time; it is a statement about what the
 * time *means*. Reading `scheduledTime` while discarding `timeModifiers` reads
 * half a sentence and grades the half it read.
 *
 * ── The five are not one thing, and the factory decides which can occur ──
 *
 * `MUTUALLY_EXCLUSIVE_TIME_MODIFIERS` — `FOLLOWED_BY`, `NEXT_AVAILABLE`,
 * `AFTER_REST`, `TO_BE_ANNOUNCED` (and `RAIN_DELAY`) — **clear `scheduledTime`
 * when written**, and writing a time clears them. Measured against the engine on
 * every write path TMX uses:
 *
 *   FOLLOWED_BY      { t: '10:00' } → { mods: ['FOLLOWED_BY'] }
 *   NOT_BEFORE       { t: '10:00' } → { t: '10:00', mods: ['NOT_BEFORE'] }
 *   TO_BE_ANNOUNCED  { t: '10:00' } → { mods: ['TO_BE_ANNOUNCED'] }
 *
 * So exactly one annotation can stand beside a live time: **`NOT_BEFORE`** — and
 * it is the one that makes the time MORE binding rather than less. "Not before
 * 14:30" is a floor. It does not withdraw 14:30; it says nothing may start
 * earlier than it.
 *
 * The factory also suppresses an annotation at hydration once the matchUp has
 * begun or resolved — called to court, part-scored, completed, walked over — on
 * the grounds that an annotation about *when a match may begin* is misinformation
 * once it has. So by the time a hydrated matchUp reaches TMX, a modifier is
 * present only while the matchUp has not started.
 *
 * ── What that leaves ──
 *
 * A blanket "these five mean the time is soft" is wrong twice over: it is dead
 * weight for four annotations that cannot reach a time at all, and it inverts
 * the one that can. This module names the three commitments instead, so each
 * consumer can read the sentence rather than pattern-match the pill.
 */

import { factoryConstants } from 'tods-competition-factory';

const { AFTER_REST, FOLLOWED_BY, NEXT_AVAILABLE, NOT_BEFORE, TO_BE_ANNOUNCED } = factoryConstants.timeItemConstants;

/**
 * What the schedule claims about a matchUp's `scheduledTime`.
 *
 * - `firm` — a stated start. No annotation, or none that qualifies it.
 * - `floor` — `NOT_BEFORE`: a real lower bound. Earlier is forbidden; later is
 *   not a broken promise.
 * - `none` — the schedule states no time. Either there is no `scheduledTime`, or
 *   an annotation says the residual number is not a claim.
 */
export type TimeCommitment = 'firm' | 'floor' | 'none';

/**
 * Annotations that contradict a written time outright.
 *
 * All of these clear `scheduledTime` on write, so a matchUp carrying both is
 * either legacy data hydrated from timeItems or a record written past the
 * engine. Kept narrow and kept honest: if such a pair arrives, the annotation
 * wins, because it is the more recent statement of intent.
 */
const WITHDRAWS_TIME = new Set<string>([FOLLOWED_BY, NEXT_AVAILABLE, AFTER_REST, TO_BE_ANNOUNCED]);

/** What the schedule commits to. Pure; takes only the fields it reads. */
export function commitmentOf(schedule?: { scheduledTime?: string; timeModifiers?: string[] } | null): TimeCommitment {
  if (!schedule?.scheduledTime) return 'none';

  const modifiers = schedule.timeModifiers ?? [];
  if (modifiers.some((modifier) => WITHDRAWS_TIME.has(modifier))) return 'none';
  // Checked after the withdrawal set: a record carrying both — which the engine
  // will not produce — should read as "no time stated" rather than as a floor.
  if (modifiers.includes(NOT_BEFORE)) return 'floor';
  return 'firm';
}
