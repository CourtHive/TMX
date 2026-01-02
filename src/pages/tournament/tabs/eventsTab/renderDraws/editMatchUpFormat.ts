/**
 * Edit matchUp format for a draw structure.
 * Prompts for format selection and updates via mutation if changed.
 */
import { getMatchUpFormat } from 'components/modals/matchUpFormat/matchUpFormat';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';

import { SET_MATCHUP_FORMAT } from 'constants/mutationConstants';

export function editMatchUpFormat({ structureId, drawId }: { structureId: string; drawId: string }): void {
  const existingMatchUpFormat = tournamentEngine.getMatchUpFormat({ drawId, structureId }).matchUpFormat;
  console.log({ existingMatchUpFormat });
  const callback = (matchUpFormat: any) => {
    console.log({ matchUpFormat });
    if (matchUpFormat) {
      if (matchUpFormat === existingMatchUpFormat) {
        tmxToast({ message: 'No changes', intent: 'is-warning' });
      } else {
        const methods = [
          {
            params: { matchUpFormat, structureId, drawId },
            method: SET_MATCHUP_FORMAT,
          },
        ];
        const postMutation = (result: any) => result.success && tmxToast({ message: 'Scoring changed' });
        mutationRequest({ methods, callback: postMutation });
      }
    }
  };
  getMatchUpFormat({ callback, existingMatchUpFormat } as any);
}
