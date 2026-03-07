/**
 * Scoring Modal - TMX integration with courthive-components
 * Configures and delegates to courthive-components scoring modal
 */
import { scoringModal as componentsScoringModal, setScoringConfig } from 'courthive-components';
import { resolveComposition } from './resolveComposition';
import { env } from 'settings/env';
import { t } from 'i18n';

// Re-export types from courthive-components
export type { ScoringModalParams, ScoreOutcome, SetScore } from 'courthive-components';

function getScoringLabels() {
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
  };
}

/**
 * Scoring modal - configures and opens courthive-components scoring modal
 * @param params - Scoring modal parameters (matchUp, callback)
 */
export function scoringModal(params: any): void {
  // Resolve composition from draw extension, localStorage, or env
  const compositionSettings = resolveComposition(params.matchUp);

  // Configure courthive-components scoring
  setScoringConfig({
    scoringApproach: env.scoringApproach || 'dynamicSets',
    smartComplements: compositionSettings.smartComplements,
    composition: compositionSettings.compositionName,
  });

  if (env.log?.verbose) {
    console.log('%c TMX → courthive-components scoring', 'color: green', {
      approach: env.scoringApproach || 'dynamicSets',
      composition: compositionSettings.compositionName,
      smartComplements: compositionSettings.smartComplements,
    });
  }

  // Call courthive-components scoringModal with i18n labels
  componentsScoringModal({ ...params, labels: getScoringLabels() });
}
