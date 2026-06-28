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
import { persistConfigToStorage } from 'services/settings/settingsStorage';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { setActiveScale } from 'settings/setActiveScale';
import { env } from 'settings/env';

import { markRatingPromptDismissed, wasRatingPromptDismissed } from './ratingPromptStorage';
import { decideActiveScaleSwitch } from './decideActiveScaleSwitch';

interface ModalButton {
  label: string;
  intent: string;
  close: boolean;
  onClick: () => void;
}

function applyScale(toScale: string): void {
  setActiveScale(toScale);
  persistConfigToStorage();
}

function chip(label: string, variant: 'available' | 'inactive'): string {
  const base = 'font-size: 1em; font-weight: 600; padding: 5px 12px; border-radius: 6px;';
  const themed =
    variant === 'available'
      ? 'background: var(--tmx-panel-blue-bg, #e7f1fa); color: var(--tmx-panel-blue-text, #2c5d8a);'
      : 'background: var(--tmx-bg-secondary, #f4f4f5); color: var(--tmx-text-primary, inherit); opacity: 0.75;';
  return `<span style="${base} ${themed}">${label}</span>`;
}

function renderPromptContent(available: string[], current: string): string {
  const availableChips = available.map((s) => chip(s.toUpperCase(), 'available')).join('');
  const sectionLabel =
    'font-size: 0.72em; font-weight: 600; letter-spacing: 0.6px; ' +
    'text-transform: uppercase; color: var(--tmx-text-secondary, #666); margin-bottom: 6px;';
  return `
    <div style="font-size: 0.92em; padding: 4px 2px;">
      <div style="margin-bottom: 16px;">
        <div style="${sectionLabel}">This tournament uses</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">${availableChips}</div>
      </div>
      <div>
        <div style="${sectionLabel}">Your active rating</div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          ${chip(current.toUpperCase(), 'inactive')}
          <span style="font-size: 0.82em; color: var(--tmx-panel-amber-text, #946200);">not in this tournament</span>
        </div>
      </div>
      <div style="
        margin-top: 16px; padding-top: 10px;
        border-top: 1px solid var(--tmx-border-secondary, #eee);
        font-size: 0.78em; color: var(--tmx-text-secondary, #666);
      ">We'll only ask once for this tournament.</div>
    </div>
  `;
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
    alreadyAsked: wasRatingPromptDismissed(tournamentId, available),
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
  const buttons: ModalButton[] = [
    ...decision.availableScales.map(
      (scale): ModalButton => ({
        label: `Use ${scale.toUpperCase()}`,
        intent: 'is-info',
        close: true,
        onClick: () => applyScale(scale),
      }),
    ),
    {
      label: `Keep ${decision.fromScale.toUpperCase()}`,
      intent: 'is-light',
      close: true,
      onClick: () => {
        // No scale change — user keeps a rating not present in this tournament.
      },
    },
  ];

  openModal({
    title: 'Switch active rating?',
    content: renderPromptContent(decision.availableScales, decision.fromScale),
    buttons,
    onClose: () => {
      // Whether the user picked a scale or dismissed, treat it as answered
      // for this specific available-scale set.
      markRatingPromptDismissed(tournamentId, decision.availableScales);
    },
  });

  // Mark immediately too, so a rapid second loadTournament call during the
  // same session doesn't re-open the modal before the first one closes.
  markRatingPromptDismissed(tournamentId, decision.availableScales);
}
