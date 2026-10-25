/**
 * Ad hoc round action options for draw structures.
 * Provides options to add/delete matchUps and rounds in ad hoc draws.
 */
import { deleteAdHocMatchUps } from 'components/modals/deleteAdHocMatchUps';
import { addAdHocMatchUps } from 'components/modals/addAdHocMatchUps';
import { addAdHocRound } from 'components/modals/addAdHocRound';
import { tournamentEngine } from 'services/factory/engine';
import {
  isConfiguredRotatingDraw,
  previewRotatingRound,
  showRotatingStandings,
} from 'services/rotatingPartners/roundControls';

import { RIGHT } from 'constants/tmxConstants';
import { t } from 'i18n';

export const deleteMatchUpsAction = 'Delete matches';
export const addMatchUpsAction = 'Add matches';
export const addRoundAction = 'Add round';

export function getAdHocRoundOptions({
  structure,
  drawId,
  callback,
}: {
  structure: any;
  drawId: string;
  callback: (params: any) => void;
}): any {
  if (!tournamentEngine.isAdHoc({ structure })) return {};
  const refreshCallback = () => callback({ refresh: true });

  if (isConfiguredRotatingDraw(drawId)) {
    return {
      label: t('roundOptions.roundActions'),
      selection: false,
      location: RIGHT,
      align: RIGHT,
      options: [
        {
          label: t('rotatingPartners.creation.applyRound'),
          onClick: () => previewRotatingRound({ drawId, structure, callback: refreshCallback }),
        },
        { label: t('rotatingPartners.creation.standings'), onClick: () => showRotatingStandings(drawId) },
      ],
    };
  }
  const actionOptions = [
    {
      onClick: () => addAdHocMatchUps({ drawId, structure, callback: refreshCallback }),
      label: addMatchUpsAction,
      color: 'var(--tmx-status-info)',
    },
    {
      onClick: () => addAdHocRound({ drawId, structure, newRound: true, callback: refreshCallback }),
      label: addRoundAction,
      color: 'var(--tmx-status-info)',
    },
    {
      label: deleteMatchUpsAction,
      color: 'var(--tmx-status-error)',
      onClick: () => deleteAdHocMatchUps({ drawId, structure, callback: refreshCallback }),
    },
  ];
  return {
    label: t('roundOptions.roundActions'),
    options: actionOptions,
    selection: false,
    location: RIGHT,
    align: RIGHT,
  };
}
