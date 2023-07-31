import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { selectPositionAction } from 'components/popovers/selectPositionAction';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { openScorecard } from 'components/overlays/scorecard/scorecard';

const { TEAM } = participantConstants;

export function getEventHandlers({ eventData, callback }) {
  const sideClick = (props) => {
    const { matchUp = {}, sideNumber } = props;

    /*
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const restore = (params) => {
      setTimeout(() => window.scrollTo({ top: scrollTop }), 100);
      callback(params);
    };
    */

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

  return {
    centerInfoClick: () => console.log('centerInfo click'),
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
                substituteWithoutScore: true,
                substituteAfterCompleted: true
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
