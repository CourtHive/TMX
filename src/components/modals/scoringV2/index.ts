/**
 * Scoring Modal - TMX integration with courthive-components
 * Configures and delegates to courthive-components scoring modal.
 * The component's menu caret allows seamless approach switching;
 * on close we sync the (possibly changed) approach back to env + localStorage.
 */
import { scoringModal as componentsScoringModal, setScoringConfig, getScoringConfig } from 'courthive-components';
import { persistConfigToStorage } from 'services/settings/settingsStorage';
import { preferencesConfig } from 'config/preferencesConfig';
import { resolveComposition } from './resolveComposition';
import { getScoringLabels } from './scoringLabels';
import { debugConfig } from 'config/debugConfig';

// Re-export types from courthive-components
export type { ScoringModalParams, ScoreOutcome, SetScore } from 'courthive-components';

/**
 * Sync the scoring approach from courthive-components config back to
 * TMX env + localStorage, so menu-driven switches persist.
 */
function syncApproachPreference() {
  const { scoringApproach } = getScoringConfig();
  if (scoringApproach && scoringApproach !== preferencesConfig.get().scoringApproach) {
    preferencesConfig.set({ scoringApproach });
    persistConfigToStorage();
  }
}

/**
 * Scoring modal - configures and opens courthive-components scoring modal
 * @param params - Scoring modal parameters (matchUp, callback)
 */
export function scoringModal(params: any): void {
  const { onRelayCleanup, ...rest } = params;

  // Resolve composition from draw extension, localStorage, or env
  const compositionSettings = resolveComposition(rest.matchUp);

  // Configure courthive-components scoring
  setScoringConfig({
    scoringApproach: preferencesConfig.get().scoringApproach || 'dynamicSets',
    smartComplements: compositionSettings.smartComplements,
    composition: compositionSettings.compositionName,
  });

  if (debugConfig.get().log?.verbose) {
    console.log('%c TMX → courthive-components scoring', 'color: green', {
      approach: preferencesConfig.get().scoringApproach || 'dynamicSets',
      composition: compositionSettings.compositionName,
      smartComplements: compositionSettings.smartComplements,
    });
  }

  // onClose fires on any modal dismissal (submit, cancel, backdrop)
  // so the approach preference syncs regardless of how the modal is closed
  const onClose = () => {
    syncApproachPreference();
    if (typeof onRelayCleanup === 'function') onRelayCleanup();
  };

  componentsScoringModal({ ...rest, onClose, labels: getScoringLabels() });
}
