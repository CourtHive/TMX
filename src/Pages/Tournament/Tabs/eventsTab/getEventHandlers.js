import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { selectPositionAction } from 'components/popovers/selectPositionAction';
import { openScorecard } from 'components/overlays/scorecard/scorecard';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function getEventHandlers({ eventData, callback }) {
  const sideClick = (props) => {
    const { matchUp = {}, sideNumber } = props;

    const side = props.side || matchUp.sides?.find((side) => side.sideNumber === sideNumber);

    const { validActions: actions } =
      (matchUp.drawId &&
        tournamentEngine.positionActions({
          sideNumber: sideNumber || side?.sideNumber,
          structureId: matchUp?.structureId,
          drawPosition: side?.drawPosition,
          matchUpId: matchUp?.matchUpId,
          drawId: matchUp?.drawId,
          policyDefinitions: {
            positionActions: {
              // disableRoundRestrictions: true
            }
          }
          /*
            policyDefinitions: {
              ...POLICY_POSITION_ACTIONS_UNRESTRICTED,
              ...(tournamentPolicies?.positionActions && { positionActions: tournamentPolicies?.positionActions }),
              ...{ seeding: tournamentPolicies?.seeding }
            }
          */
        })) ||
      {};

    selectPositionAction({ ...props, actions, callback });
  };

  const roundActions = [
    {
      onClick: () => console.log('add matchUp(s)'),
      text: 'Add matchUp(s)'
    },
    {
      onClick: () => console.log('delete matchUp(s)'),
      text: 'Delete matchUp(s)'
    },
    {
      onClick: () => console.log('delete round'),
      text: 'Delete round'
    }
  ];

  return {
    centerInfoClick: () => console.log('centerInfo click'),
    roundHeaderClick: (props) => {
      console.log('round click', props);
      if (props?.pointerEvent) {
        tipster({ items: roundActions, target: props.pointerEvent.target, config: { placement: BOTTOM } });
      }
    },
    scheduleClick: () => console.log('schedule click'),
    venueClick: () => console.log('venue click'),

    matchUpClick: () => {},
    scoreClick: (props) => {
      const { matchUp = {}, side, sideIndex } = props;
      const sideNumber = side?.sideNumber || sideIndex + 1;

      const { validActions: matchUpActions } =
        tournamentEngine.matchUpActions({
          matchUpId: matchUp.matchUpId,
          drawId: matchUp.drawId,
          sideNumber
          /*
            policyDefinitions: {
              [POLICY_TYPE_MATCHUP_ACTIONS]: {
                substituteAfterCompleted: true
                substituteWithoutScore: true,
              }
            }
          */
        }) || {};

      const readyToScore = matchUpActions?.find(({ type }) => type === 'SCORE');

      if (readyToScore) {
        if (matchUp.matchUpType === TEAM) {
          const onClose = () => callback();
          const title = eventData?.eventInfo?.eventName;

          const { matchUpId, drawId } = matchUp;
          openScorecard({ title, drawId, matchUpId, onClose });
        } else {
          enterMatchUpScore({ matchUpId: readyToScore.payload.matchUpId, callback });
        }
      }
    },
    participantClick: sideClick
  };
}
