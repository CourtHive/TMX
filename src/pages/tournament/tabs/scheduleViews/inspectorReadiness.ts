/**
 * Schedule2 — Inspector readiness section, and the composition of everything
 * TMX contributes to the courthive-components Inspector.
 *
 * The impure half of the readiness feature: gathers factory data, resolves
 * timing through the engine, and renders the result into the Inspector via its
 * `renderInspectorExtra` hook. All rules live in the pure `matchUpReadiness.ts`;
 * this file decides nothing.
 *
 * Timing comes from the shared `scheduleTimingResolver`, which is what the
 * auto-scheduler itself resolves against (including its scheduling-policy
 * fallback, so unpoliced tournaments still get per-format averages rather than a
 * flat 90/0). Sharing the resolver with the rest section is what keeps the two
 * from disagreeing about what a format costs.
 *
 * Readiness and rest answer *different* questions and are both rendered:
 * readiness asks "can this placement happen at the time it is scheduled for"
 * (and skips when there is no time), rest asks "how long have these players
 * actually had off, as of now" (and answers for an unscheduled matchUp, which is
 * the moment the director is deciding whether to call it).
 */

import { makeTimingResolver } from './scheduleTimingResolver';
import { analyzeMatchUpReadiness } from './matchUpReadiness';
import { renderInspectorActions } from './inspectorActions';
import { getCachedAllMatchUps } from './schedule2DataCache';
import { renderRestSection } from './inspectorRest';
import { t } from 'i18n';

// constants and types
import type { ReadinessFinding, ReadinessMatchUp, ReadinessResult } from './matchUpReadiness';

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

/**
 * Everything TMX adds to the Inspector, for one selected matchUp. Wired as the
 * schedule page's `renderInspectorExtra`; returns a fresh element per call
 * because the Inspector rebuilds its body on every state change.
 */
export function renderInspectorSections(matchUpId: string, viewedDate: string | null): HTMLElement | null {
  if (!matchUpId) return null;

  const container = document.createElement('div');
  container.className = 'tmx-inspector-extra';

  // Deliberately a SIBLING of the rest section rather than a child of it: the
  // rest section replaces its own children every 30 seconds to keep the figures
  // counting up, which would destroy an open popover mid-interaction.
  const actions = renderInspectorActions(matchUpId);
  if (actions) container.appendChild(actions);

  const rest = renderRestSection(matchUpId, viewedDate);
  if (rest) container.appendChild(rest);

  const readiness = renderReadinessSection(matchUpId);
  if (readiness) container.appendChild(readiness);

  return container;
}
