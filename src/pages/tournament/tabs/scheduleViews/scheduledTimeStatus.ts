/**
 * Schedule2 — what colour a card's scheduled time should be.
 *
 * The Scheduled tab painted every `scheduledTime` the same green, which made the
 * most prominent glyph on the card the one carrying the least information: a time
 * the matchUp cannot possibly start at looked exactly like a time it can. The
 * readiness analysis already knows the difference — it was just locked inside the
 * Inspector, one selection away, while the decision the colour serves is made
 * while scanning.
 *
 * ── The grading, and why it is by kind rather than by minutes ──
 *
 * Agreed with CA 2026-09-13. Severity follows the *nature* of the blocker, not
 * how many minutes late it is:
 *
 *   - `alert` (red)    — the matchUp cannot start at that time. Either a
 *                        participant is on court elsewhere (`overlap`) or an
 *                        upstream feeder is projected past the start / is not
 *                        scheduled at all (`dependency`). In both cases the time
 *                        as written is a fiction.
 *   - `warn` (yellow)  — it can start, but a recovery window is violated
 *                        (`recovery`). Playable, and the director's call.
 *   - `ok` (green)     — evaluated, with no WARN finding.
 *
 * A minutes threshold was the alternative and was rejected: "five minutes late"
 * and "an hour late" are the same fact about whether the placement holds, and a
 * cutoff would have to be defended per tournament. The `title` carries the detail
 * for anyone who wants the magnitude.
 *
 * An INFO-only result stays green on purpose. `undetermined` alone means the
 * sides are not known yet *and the upstream still finishes in time* — which is
 * the normal state of a well-built schedule, not a problem. When the upstream
 * does not finish in time, `analyzeMatchUpReadiness` emits the `dependency`
 * finding alongside it, and that is what turns the time red.
 *
 * Pure: takes a `ReadinessResult`, returns a model. Everything factory-backed
 * happens in `inspectorReadiness.evaluateReadiness`.
 */

import { describeFinding } from './readinessDescribe';
import { t } from 'i18n';

// constants and types
import type { ReadinessFinding, ReadinessResult } from './matchUpReadiness';

/** Matches `CardTimeStatus` in courthive-components — the card knows the tier, not the rule. */
export type ScheduledTimeStatus = 'ok' | 'warn' | 'alert';

export interface ScheduledTimeModel {
  status: ScheduledTimeStatus;
  /** Hover text: the headline for the tier, then one line per finding. */
  title: string;
}

/** Blocker kinds that make the scheduled time impossible rather than merely compromised. */
const IMPOSSIBLE = new Set(['overlap', 'dependency']);

/** WARN findings only — INFO findings describe the schedule, they do not indict it. */
function blocking(findings: ReadinessFinding[]): ReadinessFinding[] {
  return findings.filter((finding) => finding.severity === 'WARN');
}

/** The tier for a set of findings. See the header for why it reads kinds, not minutes. */
export function statusFor(findings: ReadinessFinding[]): ScheduledTimeStatus {
  const warnings = blocking(findings);
  if (warnings.some((finding) => IMPOSSIBLE.has(finding.kind))) return 'alert';
  if (warnings.length) return 'warn';
  return 'ok';
}

/**
 * The card's time model, or null when readiness could not be evaluated.
 *
 * Null rather than `ok`: an unevaluated matchUp is not a clean one, and painting
 * it the "this time holds" green would be a claim the analysis never made. The
 * card leaves an ungraded header at its default styling.
 */
export function scheduledTimeModel(result: ReadinessResult): ScheduledTimeModel | null {
  if (!result.evaluated) return null;

  const status = statusFor(result.findings);
  const heading = t(`schedule.card.time.${status}`);
  // Every finding is listed, not just the one that set the tier: the tier answers
  // "how bad", the lines answer "why", and an operator hovering a red time needs
  // the second. Order is `analyzeMatchUpReadiness`'s, which is strongest-first.
  const lines = result.findings.map(describeFinding);
  return { status, title: [heading, ...lines].join('\n') };
}
