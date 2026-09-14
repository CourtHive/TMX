/**
 * Schedule2 — what this matchUp's format costs, in the Inspector.
 *
 * The panel already names the format (`SET1-S:6NOAD/TB7`) and then spends three
 * sections reasoning from what it costs: rest counts against a recovery
 * requirement, readiness projects a finish from an average, and the Now strip's
 * runway asks whether a match still fits. The two numbers underneath all of that
 * were never on screen, so an operator could see "needs recovery time" without
 * being able to see how much recovery this event actually asks for.
 *
 * ── Resolved, not configured ──
 *
 * These are the figures the SCHEDULER uses, resolved through
 * `scheduleTimingResolver` — the same lookup readiness and rest already share,
 * including its category handling, so the Inspector cannot quote a number the
 * analysis below it disagrees with. Event-level policy beats tournament-level
 * beats the factory default, and the panel says which of the three answered.
 *
 * That provenance is a separate question from the figures, and the engine does
 * not report it, so it is asked separately: `getAppliedPolicies` for
 * `scheduling`, once with the event and once without. Present with the event but
 * not without it means the event carries its own.
 */

import { makeTimingResolver } from './scheduleTimingResolver';
import { getCachedAllMatchUps } from './schedule2DataCache';
import { policyConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { formatDuration } from './inspectorRest';
import { t } from 'i18n';

// constants and types
import type { ReadinessMatchUp } from './matchUpReadiness';
import type { RestTiming } from './participantRest';

const { POLICY_TYPE_SCHEDULING } = policyConstants;

/** Which level of policy answered — the panel says so rather than implying the numbers are universal. */
export type TimingSource = 'event' | 'tournament' | 'default';

export interface TimingModel {
  averageMinutes: number;
  recoveryMinutes: number;
  /** Present only when a singles ↔ doubles change costs something different. */
  typeChangeRecoveryMinutes?: number;
  source: TimingSource;
}

/**
 * The model for one matchUp's timing, or null when there is nothing to say.
 *
 * Null for a matchUp with no format: `makeTimingResolver` falls back to a flat
 * 90/0 in that case, and printing that as though it had been resolved would be
 * a fiction dressed as a figure. The Format row above already reads `—`.
 */
export function buildTimingModel(
  matchUp: ReadinessMatchUp | undefined,
  timing: RestTiming,
  source: TimingSource,
): TimingModel | null {
  if (!matchUp?.matchUpFormat) return null;

  const typeChange = timing.typeChangeRecoveryMinutes ?? 0;
  return {
    averageMinutes: timing.averageMinutes,
    recoveryMinutes: timing.recoveryMinutes,
    // Only when it differs: a type-change figure equal to the ordinary one says
    // nothing, and the Rest rows below already mark which players it applied to.
    ...(typeChange && typeChange !== timing.recoveryMinutes ? { typeChangeRecoveryMinutes: typeChange } : {}),
    source,
  };
}

/** "1h 30m average · 1h 0m recovery" — the panel's own duration vocabulary, so the figures read alike. */
export function describeTiming(model: TimingModel): string {
  const parts = [
    t('schedule.inspector.timing.average', { minutes: formatDuration(model.averageMinutes) }),
    t('schedule.inspector.timing.recovery', { minutes: formatDuration(model.recoveryMinutes) }),
  ];
  if (model.typeChangeRecoveryMinutes !== undefined) {
    parts.push(t('schedule.inspector.timing.typeChange', { minutes: formatDuration(model.typeChangeRecoveryMinutes) }));
  }
  return parts.join(' · ');
}

/** Which scheduling policy answered, asked once with the event and once without. */
function resolveSource(eventId?: string): TimingSource {
  const { tournamentRecord }: any = tournamentEngine.getTournament() ?? {};
  const event = (tournamentRecord?.events ?? []).find((candidate: any) => candidate.eventId === eventId);

  const applied = (scope?: any) =>
    !!(
      tournamentEngine.getAppliedPolicies({ policyTypes: [POLICY_TYPE_SCHEDULING], ...(scope && { event: scope }) })
        ?.appliedPolicies as any
    )?.[POLICY_TYPE_SCHEDULING];

  if (!applied(event)) return 'default';
  return applied() ? 'tournament' : 'event';
}

/**
 * The Inspector's timing block. Returns a fresh element per call, matching the
 * panel's rebuild-on-every-render contract, or null when the matchUp carries no
 * format to price.
 */
export function renderTimingSection(matchUpId: string): HTMLElement | null {
  if (!matchUpId) return null;

  const { matchUps } = getCachedAllMatchUps();
  const matchUp = ((matchUps ?? []) as ReadinessMatchUp[]).find((candidate) => candidate.matchUpId === matchUpId);
  if (!matchUp?.matchUpFormat) return null;

  const model = buildTimingModel(matchUp, makeTimingResolver()(matchUp), resolveSource(matchUp.eventId));
  if (!model) return null;

  const section = document.createElement('div');
  section.className = 'tmx-timing';
  section.dataset.timingSource = model.source;

  const heading = document.createElement('div');
  heading.className = 'tmx-timing-heading';
  heading.textContent = t('schedule.inspector.timing.heading');
  section.appendChild(heading);

  const figures = document.createElement('div');
  figures.className = 'tmx-timing-figures';
  figures.textContent = describeTiming(model);
  section.appendChild(figures);

  const source = document.createElement('div');
  source.className = 'tmx-timing-source';
  source.textContent = t(`schedule.inspector.timing.source.${model.source}`);
  section.appendChild(source);

  return section;
}
