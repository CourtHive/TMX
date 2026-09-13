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

import { describeFinding, skipMessage } from './readinessDescribe';
import { makeTimingResolver } from './scheduleTimingResolver';
import { analyzeMatchUpReadiness } from './matchUpReadiness';
import { renderInspectorActions } from './inspectorActions';
import { getCachedAllMatchUps } from './schedule2DataCache';
import { renderRestSection } from './inspectorRest';
import { t } from 'i18n';

// constants and types
import type { ReadinessMatchUp, ReadinessResult } from './matchUpReadiness';

/**
 * A readiness evaluator valid for one pass, sharing the engine work across every
 * matchUp it is asked about.
 *
 * `makeTimingResolver()` walks the tournament's events, which costs a
 * `getTournament()`. Paying for that once is fine for the Inspector's single
 * matchUp and wrong for the Scheduled panel, which now grades the time header of
 * every card it draws — that would be one tournament walk per card, the same
 * trap `restBadge.ts` documents measuring at ~235ms of a ~300ms render.
 */
export function makeReadinessEvaluator(): (matchUpId: string) => ReadinessResult {
  const { matchUps } = getCachedAllMatchUps();
  const hydrated = (matchUps ?? []) as ReadinessMatchUp[];
  const timingFor = makeTimingResolver();
  return (matchUpId) => analyzeMatchUpReadiness({ matchUpId, matchUps: hydrated, timingFor });
}

/**
 * One evaluator per synchronous pass, released on the next microtask.
 *
 * Same boundary and the same reasoning as `inspectorRest.evaluatorForPass`: it is
 * the tightest release that still covers a whole render, so every card in a pass
 * is graded against one reading of tournament state and nothing survives into a
 * task where a mutation could have replaced it.
 */
let passEvaluator: ReturnType<typeof makeReadinessEvaluator> | null = null;

function evaluatorForPass(): ReturnType<typeof makeReadinessEvaluator> {
  if (!passEvaluator) {
    passEvaluator = makeReadinessEvaluator();
    queueMicrotask(() => {
      passEvaluator = null;
    });
  }
  return passEvaluator;
}

/** Readiness for one matchUp, resolved against current factory state. */
export function evaluateReadiness(matchUpId: string): ReadinessResult {
  return evaluatorForPass()(matchUpId);
}

function line(text: string, className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
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
