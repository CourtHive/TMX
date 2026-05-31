/**
 * Detect whether a freshly loaded tournament carries the user's active
 * rating and react: silently switch when exactly one scale is present,
 * prompt once per tournament when multiple are present but none match.
 *
 * Call this once after `tournamentEngine.setState(...)` in the load
 * path. Cheap — bails fast when participants are absent or active scale
 * is already valid for the tournament.
 */
import { collectAvailableScales } from 'components/charts/participantScalings';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { persistConfigToStorage } from 'services/settings/settingsStorage';
import { setActiveScale } from 'settings/setActiveScale';
import { env } from 'settings/env';

import { decideActiveScaleSwitch } from './decideActiveScaleSwitch';
import { markRatingPromptDismissed, wasRatingPromptDismissed } from './ratingPromptStorage';

function applyScale(toScale: string): void {
  setActiveScale(toScale);
  persistConfigToStorage();
}

export function runActiveScaleAutoSwitch(): void {
  const tournament = tournamentEngine.getTournament?.()?.tournamentRecord;
  const tournamentId = tournament?.tournamentId;
  if (!tournamentId) return;

  const { participants = [] } = tournamentEngine.getParticipants({ withScaleValues: true }) ?? {};
  const available = collectAvailableScales(participants).map((s) => s.scaleName);

  const decision = decideActiveScaleSwitch({
    activeScale: env.activeScale,
    availableScaleNames: available,
    alreadyAsked: wasRatingPromptDismissed(tournamentId),
  });

  if (decision.action === 'no-op') return;

  if (decision.action === 'switch') {
    applyScale(decision.toScale!);
    tmxToast({
      message: `Active rating switched to ${decision.toScale!.toUpperCase()} — only rating in this tournament.`,
      intent: 'is-info',
      duration: 5000,
    });
    return;
  }

  // action === 'prompt'
  const buttons = decision.availableScales
    .map((scale) => ({
      label: `Use ${scale.toUpperCase()}`,
      intent: 'is-info',
      close: true,
      onClick: () => applyScale(scale),
    }))
    .concat([
      {
        label: `Keep ${decision.fromScale.toUpperCase()}`,
        intent: 'is-light' as any,
        close: true,
        onClick: () => {
          // No scale change — user stays on a rating not present in this tournament.
        },
      } as any,
    ]);

  const presentList = decision.availableScales.map((s) => s.toUpperCase()).join(', ');
  const content = `
    <div style="font-size: 0.95em; line-height: 1.5;">
      <p>This tournament's participants carry <strong>${presentList}</strong> ratings.</p>
      <p>Your active rating is <strong>${decision.fromScale.toUpperCase()}</strong>, which isn't present here.</p>
      <p style="margin-top: 8px; color: var(--tmx-text-secondary, #666); font-size: 0.9em;">
        We'll only ask once for this tournament.
      </p>
    </div>
  `;

  openModal({
    title: 'Switch active rating?',
    content,
    buttons,
    onClose: () => {
      // Whether the user picked a scale or dismissed, treat it as answered.
      markRatingPromptDismissed(tournamentId);
    },
  });

  // Mark immediately too, so a rapid second loadTournament call during the
  // same session doesn't re-open the modal before the first one closes.
  markRatingPromptDismissed(tournamentId);
}
