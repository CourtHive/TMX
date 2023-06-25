import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { tournamentEngine } from 'tods-competition-factory';

export function getValidActions(params) {
  const { matchUp = {}, sideIndex, side, callback } = params;

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

  const sideNumber = sideIndex + 1;
  const { validActions: matchUpActions } =
    tournamentEngine.matchUpActions({
      sideNumber: 3 - sideNumber,
      matchUpId: matchUp.matchUpId,
      drawId: matchUp.drawId
      /*
    policyDefinitions: {
      [POLICY_TYPE_MATCHUP_ACTIONS]: {
        substituteWithoutScore: true,
        substituteAfterCompleted: true
      }
    }
    */
    }) || {};
  console.log({ matchUp, positionActions, matchUpActions });

  const readyToScore = matchUpActions?.find(({ type }) => type === 'SCORE');
  if (readyToScore) {
    if (matchUp.matchUpType === 'TEAM') {
      console.log('team scorecard');
    } else {
      enterMatchUpScore({ matchUpId: readyToScore.payload.matchUpId, callback });
    }
  }
}
