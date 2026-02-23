/**
 * Edit matchUp format for a draw structure.
 * Prompts for format selection and updates via mutation if changed.
 */
import { getMatchUpFormatModal } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

import { SET_MATCHUP_FORMAT } from 'constants/mutationConstants';

export function editMatchUpFormat({ structureId, drawId }: { structureId: string; drawId: string }): void {
  const existingMatchUpFormat = tournamentEngine.getMatchUpFormat({ drawId, structureId }).matchUpFormat;
  const callback = (matchUpFormat: any) => {
    if (matchUpFormat) {
      if (matchUpFormat === existingMatchUpFormat) {
        tmxToast({ message: t('pages.events.editFormat.noChanges'), intent: 'is-warning' });
      } else {
        const methods = [
          {
            params: { matchUpFormat, structureId, drawId },
            method: SET_MATCHUP_FORMAT,
          },
        ];
        const postMutation = (result: any) => result.success && tmxToast({ message: t('pages.events.editFormat.scoringChanged') });
        mutationRequest({ methods, callback: postMutation });
      }
    }
  };
  getMatchUpFormatModal({
    callback,
    existingMatchUpFormat,
    modalConfig: {
      style: {
        fontSize: '12px',
        border: '3px solid var(--tmx-border-focus)',
      },
    },
  } as any);
}
