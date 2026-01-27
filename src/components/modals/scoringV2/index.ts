/**
 * Scoring Modal - TMX integration with courthive-components
 * Configures and delegates to courthive-components scoring modal
 */
import { scoringModal as componentsScoringModal, setScoringConfig } from 'courthive-components';
import { resolveComposition } from './resolveComposition';
import { env } from 'settings/env';

// Re-export types from courthive-components
export type { ScoringModalParams, ScoreOutcome, SetScore } from 'courthive-components';

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

  // Call courthive-components scoringModal
  componentsScoringModal(params);
}
