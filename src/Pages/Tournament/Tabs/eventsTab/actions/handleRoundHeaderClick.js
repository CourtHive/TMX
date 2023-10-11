import { deleteAdHocMatchUps } from 'components/modals/deleteAdHocMatchUps';
import { addAdHocMatchUps } from 'components/modals/addAdHocMatchUps';
import { addAdHocRound } from 'components/modals/addAdHocRound';
import { tipster } from 'components/popovers/tipster';
import { utilities } from 'tods-competition-factory';

import { addMatchUpsAction, addRoundAction, deleteMatchUpsAction } from './adHocActions';
import { BOTTOM } from 'constants/tmxConstants';

export function handleRoundHeaderClick(props) {
  const { structureId, drawId } = props?.context ?? {};
  const structure = props.eventData?.drawsData
    ?.find((drawData) => drawData.drawId === drawId)
    ?.structures?.find((s) => s.structureId === structureId);

  const roundActions = [];

  if (utilities.isAdHoc({ structure })) {
    const adHocRoundAction = [
      {
        onClick: () => addAdHocMatchUps({ ...props?.context, ...props }),
        text: addMatchUpsAction,
        color: 'blue'
      },
      {
        onClick: () => addAdHocRound({ ...props?.context, ...props, roundNumber: undefined, newRound: true }),
        text: addRoundAction,
        color: 'blue'
      },
      {
        onClick: () => deleteAdHocMatchUps({ ...props?.context, ...props }),
        text: deleteMatchUpsAction,
        color: 'red'
      }
    ];

    roundActions.push(...adHocRoundAction);
  }

  if (props?.pointerEvent && roundActions.length) {
    tipster({ items: roundActions, target: props.pointerEvent.target, config: { placement: BOTTOM } });
  }
}
