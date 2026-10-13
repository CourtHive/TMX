import { t } from 'i18n';

export function getScoringLabels() {
  return {
    title: t('modals.scoring.title'),
    cancel: t('modals.scoring.cancel'),
    clear: t('modals.scoring.clear'),
    submit: t('modals.scoring.submit'),
    format: t('modals.scoring.format'),
    irregularEnding: t('modals.scoring.irregularEnding'),
    winner: t('modals.scoring.winner'),
    retired: t('modals.scoring.retired'),
    walkover: t('modals.scoring.walkover'),
    defaulted: t('modals.scoring.defaulted'),
    validScore: t('modals.scoring.validScore'),
    scoreIncomplete: t('modals.scoring.scoreIncomplete'),
    invalidScore: t('modals.scoring.invalidScore'),
    scoreTips: t('modals.scoring.scoreTips'),
    setScores: t('modals.scoring.setScores'),
    tiebreaks: t('modals.scoring.tiebreaks'),
    matchTiebreaks: t('modals.scoring.matchTiebreaks'),
    irregularEndings: t('modals.scoring.irregularEndings'),
    abandoned: t('modals.scoring.abandoned'),
    cancelled: t('modals.scoring.cancelled'),
    incomplete: t('modals.scoring.incomplete'),
    reasonCode: t('modals.scoring.reasonCode'),
    noReasonCode: t('modals.scoring.noReasonCode'),
    deadRubber: t('modals.scoring.deadRubber'),
    challenged: t('modals.scoring.challenged'),
    statusUnavailable: t('modals.scoring.statusUnavailable', { status: '{{status}}' }),
    suspended: t('modals.scoring.suspended'),
    inProgress: t('modals.scoring.inProgress'),
    awaitingResult: t('modals.scoring.awaitingResult'),
  };
}

/** The score-entry card uses status-keyed labels; the legacy modal uses named labels. */
export function getScoreEntryLabels(): Record<string, string> {
  const labels = getScoringLabels();
  return {
    RETIRED: labels.retired,
    WALKOVER: labels.walkover,
    DEFAULTED: labels.defaulted,
    ABANDONED: labels.abandoned,
    CANCELLED: labels.cancelled,
    INCOMPLETE: labels.incomplete,
    SUSPENDED: labels.suspended,
    IN_PROGRESS: labels.inProgress,
    AWAITING_RESULT: labels.awaitingResult,
    DEAD_RUBBER: labels.deadRubber,
    CHALLENGED: labels.challenged,
    statusUnavailable: labels.statusUnavailable,
  };
}
