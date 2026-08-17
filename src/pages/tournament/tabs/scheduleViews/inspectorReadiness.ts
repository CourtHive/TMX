/**
 * Schedule2 — Inspector readiness section.
 *
 * The impure half of the readiness feature: gathers factory data, resolves
 * timing through the engine, and renders the result into the courthive-components
 * Inspector via its `renderInspectorExtra` hook. All rules live in the pure
 * `matchUpReadiness.ts`; this file decides nothing.
 *
 * Timing comes from `tournamentEngine.getMatchUpFormatTiming`, which is what the
 * auto-scheduler itself resolves against (including its scheduling-policy
 * fallback, so unpoliced tournaments still get per-format averages rather than a
 * flat 90/0). Resolution is memoised per `matchUpFormat|matchUpType` for the life
 * of one render pass — a tournament has a handful of distinct pairs, not one per
 * matchUp.
 */

import { getCachedAllMatchUps } from './schedule2DataCache';
import { analyzeMatchUpReadiness } from './matchUpReadiness';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

// constants and types
import type { ReadinessFinding, ReadinessMatchUp, ReadinessResult, ReadinessTiming } from './matchUpReadiness';

const FALLBACK_TIMING: ReadinessTiming = { averageMinutes: 90, recoveryMinutes: 0 };

/** Engine-backed timing lookup, memoised per format + type. */
function makeTimingResolver(): (matchUp: ReadinessMatchUp) => ReadinessTiming {
  const cache = new Map<string, ReadinessTiming>();
  return (matchUp: ReadinessMatchUp) => {
    const matchUpFormat = matchUp.matchUpFormat ?? '';
    const key = `${matchUpFormat}|${matchUp.matchUpType ?? ''}`;
    const cached = cache.get(key);
    if (cached) return cached;

    // A missing format cannot be resolved; the flat fallback keeps the
    // arithmetic running rather than dropping every finding silently.
    let timing = FALLBACK_TIMING;
    if (matchUpFormat) {
      // `matchUpType` is a plain string on the hydrated matchUp but an
      // `EventTypeUnion` on the engine signature; the engine validates it and
      // falls back to SINGLES, so widen at the boundary rather than duplicating
      // the union here.
      const result: any = tournamentEngine.getMatchUpFormatTiming({
        eventType: matchUp.matchUpType as any,
        matchUpFormat,
      });
      if (!result?.error) {
        timing = {
          averageMinutes: result?.averageMinutes ?? FALLBACK_TIMING.averageMinutes,
          recoveryMinutes: result?.recoveryMinutes ?? FALLBACK_TIMING.recoveryMinutes,
        };
      }
    }
    cache.set(key, timing);
    return timing;
  };
}

/** Readiness for one matchUp, resolved against current factory state. */
export function evaluateReadiness(matchUpId: string): ReadinessResult {
  const { matchUps } = getCachedAllMatchUps();
  return analyzeMatchUpReadiness({
    matchUpId,
    matchUps: (matchUps ?? []) as ReadinessMatchUp[],
    timingFor: makeTimingResolver(),
  });
}

function line(text: string, className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

/**
 * One finding as a sentence. Phrasing tracks `scheduleResultsDescribe.ts` so the
 * auto-scheduler's deferral reasons and the Inspector describe the same condition
 * the same way.
 */
export function describeFinding(finding: ReadinessFinding): string {
  const names = finding.participantNames?.join(', ') ?? '';
  const labels = finding.matchUpLabels?.join(', ') ?? '';
  const notBefore = finding.notBefore;

  if (finding.kind === 'overlap') return t('schedule.inspector.readiness.overlap', { names, labels });
  if (finding.kind === 'recovery') {
    return notBefore
      ? t('schedule.inspector.readiness.recoveryNotBefore', { names, time: notBefore })
      : t('schedule.inspector.readiness.recovery', { names });
  }
  if (finding.kind === 'dependency') {
    return notBefore
      ? t('schedule.inspector.readiness.dependencyNotBefore', { labels, time: notBefore })
      : t('schedule.inspector.readiness.dependencyUnscheduled', { labels });
  }
  return t('schedule.inspector.readiness.undetermined', { labels });
}

function skipMessage(reason: string): string {
  const key = `schedule.inspector.readiness.skip.${reason}`;
  const message = t(key);
  // `t()` echoes the key when it resolves to nothing; fall back to the generic
  // line rather than printing a dotted path at the operator.
  return message === key ? t('schedule.inspector.readiness.skip.generic') : message;
}

/**
 * The `renderInspectorExtra` implementation. Returns a fresh element per call —
 * the Inspector rebuilds its body on every state change, so a cached node would
 * be re-parented rather than reused.
 */
export function renderReadinessSection(matchUpId: string): HTMLElement | null {
  if (!matchUpId) return null;

  const result = evaluateReadiness(matchUpId);

  const section = document.createElement('div');
  section.className = 'tmx-readiness';
  section.dataset.readiness = result.evaluated ? String(result.findings.length) : 'skipped';
  section.appendChild(line(t('schedule.inspector.readiness.heading'), 'tmx-readiness-heading'));

  if (!result.evaluated) {
    section.appendChild(line(skipMessage(result.reason), 'tmx-readiness-skip'));
    return section;
  }

  if (!result.findings.length) {
    section.appendChild(line(t('schedule.inspector.readiness.ready'), 'tmx-readiness-ok'));
    return section;
  }

  for (const finding of result.findings) {
    const row = line(describeFinding(finding), `tmx-readiness-finding is-${finding.severity.toLowerCase()}`);
    row.dataset.kind = finding.kind;
    section.appendChild(row);
  }
  return section;
}
