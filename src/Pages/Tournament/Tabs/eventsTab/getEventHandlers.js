import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { tournamentEngine } from 'tods-competition-factory';

export function getEventHandlers({ callback }) {
  const sideClick = (props) => {
    const { matchUp = {}, side } = props;

    const { validActions: positionActions } =
      (matchUp.drawId &&
        tournamentEngine.positionActions({
          structureId: matchUp?.structureId,
          drawPosition: side?.drawPosition,
          matchUpId: matchUp?.matchUpId,
          sideNumber: side?.sideNumber,
          drawId: matchUp?.drawId
          /*
            policyDefinitions: {
              ...POLICY_POSITION_ACTIONS_UNRESTRICTED,
              ...(tournamentPolicies?.positionActions && { positionActions: tournamentPolicies?.positionActions }),
              ...{ seeding: tournamentPolicies?.seeding }
            }
          */
        })) ||
      {};

    console.log({ positionActions, matchUp });
  };
  return {
    /*
    // TODS-REACT-DRAWS
    onScheduleClick: (props) => console.log('Schedule', props),
    onRoundNameClick: (props) => console.log('Round Name', props),
    onScoreClick: (props) => console.log('Scoring', props),
    onHeaderClick: (props) => console.log('header', props),
    onStatsClick: (props) => console.log('stats', props),
    onParticipantClick: (params) => console.log('participant', props),
    */

    matchUpClick: () => {},
    headerClick: (props) => console.log('Header', props),
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
        if (matchUp.matchUpType === 'TEAM') {
          console.log('team scorecard');
        } else {
          enterMatchUpScore({ matchUpId: readyToScore.payload.matchUpId, callback });
        }
      }
    },
    participantClick: sideClick,
    sideClick
  };
}
