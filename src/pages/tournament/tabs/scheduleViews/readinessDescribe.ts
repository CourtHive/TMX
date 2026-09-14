/**
 * Schedule2 — readiness findings as sentences.
 *
 * Split out of `inspectorReadiness.ts` so that saying what a finding *means* does
 * not require reaching the factory. The Inspector renders these into a panel; the
 * Scheduled tab's time header renders the same sentences into a tooltip, and it
 * has no business importing the Inspector's action menu (and everything that
 * pulls in) to do it.
 *
 * Phrasing tracks `scheduleResultsDescribe.ts` so the auto-scheduler's deferral
 * reasons and every readiness surface describe the same condition the same way.
 */

import { t } from 'i18n';

// constants and types
import type { ReadinessFinding } from './matchUpReadiness';

/** One finding as a sentence. */
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
    // Both figures when they differ — the court-free projection and the
    // recovery-inclusive one. See `ReadinessFinding.readyAt` for why they are
    // two facts rather than one rounded differently.
    if (notBefore && finding.readyAt) {
      return t('schedule.inspector.readiness.dependencyBoth', {
        labels,
        finishes: notBefore,
        ready: finding.readyAt,
      });
    }
    return notBefore
      ? t('schedule.inspector.readiness.dependencyNotBefore', { labels, time: notBefore })
      : t('schedule.inspector.readiness.dependencyUnscheduled', { labels });
  }
  return t('schedule.inspector.readiness.undetermined', { labels });
}

/** Why readiness was not evaluated, as a sentence. */
export function skipMessage(reason: string): string {
  const key = `schedule.inspector.readiness.skip.${reason}`;
  const message = t(key);
  // `t()` echoes the key when it resolves to nothing; fall back to the generic
  // line rather than printing a dotted path at the operator.
  return message === key ? t('schedule.inspector.readiness.skip.generic') : message;
}
