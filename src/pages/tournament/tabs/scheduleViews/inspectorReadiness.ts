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
import { applyRelatedHighlight } from 'courthive-components';
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
 * The earliest time every blocker has cleared, `HH:MM`.
 *
 * The LATEST `notBefore` across the findings, not the earliest: each one is a
 * floor, and the matchUp can only start once all of them are met. Taking the
 * first would seed the picker with a time that is still blocked by something
 * else the same panel is displaying.
 */
function earliestNotBefore(matchUpId: string): string | undefined {
  const result = evaluateReadiness(matchUpId);
  if (!result.evaluated) return undefined;
  const times = result.findings.map((finding) => finding.notBefore).filter(Boolean) as string[];
  // `HH:MM` is lexicographically ordered, so a string comparison is the clock one.
  return times.length ? times.toSorted((a, b) => a.localeCompare(b)).at(-1) : undefined;
}

/**
 * "This one is on the grid now" — the line that explains an Inspector nobody
 * can see a selection for.
 *
 * A matchUp dragged onto a court leaves BOTH sidebar lists: the Unscheduled
 * catalog hides it (it is scheduled) and the Scheduled panel only carries
 * matchUps that have a time but no court. The Inspector keeps showing it, which
 * is right — the placement is exactly what an operator wants to check the moment
 * it is made — but with no card highlighted anywhere, the panel reads as though
 * it might be describing any of the cards that ARE visible. Observed on a live
 * tournament where another client did the dragging, which is when it is most
 * confusing: the selection appears to change on its own.
 *
 * Keyed on the court rather than on list membership: a court assignment is a
 * fact about the matchUp, where "is it in the visible list" depends on which tab
 * is open, what is typed in the search box and which filters are set — four
 * inputs to get wrong, in a component that would have to duplicate the catalog's
 * filter to know.
 */
function placedElsewhere(matchUp: CatalogSelection): HTMLElement | null {
  if (!matchUp.scheduledCourtName) return null;

  const note = line(
    matchUp.scheduledTime
      ? t('schedule.inspector.placedAt', { court: matchUp.scheduledCourtName, time: matchUp.scheduledTime })
      : t('schedule.inspector.placed', { court: matchUp.scheduledCourtName }),
    'tmx-inspector-placed',
  );
  note.dataset.matchUpId = matchUp.matchUpId;
  note.title = t('schedule.inspector.placedHint');
  // Clicking points at it: the cell lights up with the same highlight a card
  // hover uses, which is the shortest answer to "where did it go".
  note.addEventListener('click', () => applyRelatedHighlight([matchUp.matchUpId]));
  return note;
}

/** What the Inspector's own fields are drawn from — only the parts TMX reads. */
export interface CatalogSelection {
  matchUpId: string;
  scheduledTime?: string;
  scheduledCourtName?: string;
}

/**
 * Everything TMX adds to the Inspector, for one selected matchUp. Wired as the
 * schedule page's `renderInspectorExtra`; returns a fresh element per call
 * because the Inspector rebuilds its body on every state change.
 */
export function renderInspectorSections(selection: CatalogSelection, viewedDate: string | null): HTMLElement | null {
  const matchUpId = selection.matchUpId;
  if (!matchUpId) return null;

  const container = document.createElement('div');
  container.className = 'tmx-inspector-extra';

  // Deliberately a SIBLING of the rest section rather than a child of it: the
  // rest section replaces its own children every 30 seconds to keep the figures
  // counting up, which would destroy an open popover mid-interaction.
  // Readiness is evaluated here as well as inside the section — the pass
  // evaluator makes the second call free — so the actions menu can open its time
  // picker at the hour the panel is about to name.
  const actions = renderInspectorActions(matchUpId, { viewedDate, notBefore: earliestNotBefore(matchUpId) });
  if (actions) container.appendChild(actions);

  const placed = placedElsewhere(selection);
  if (placed) container.appendChild(placed);

  const rest = renderRestSection(matchUpId, viewedDate);
  if (rest) container.appendChild(rest);

  const readiness = renderReadinessSection(matchUpId);
  if (readiness) container.appendChild(readiness);

  return container;
}
