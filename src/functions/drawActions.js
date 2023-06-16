import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { tournamentEngine } from 'tods-competition-factory';

export function getValidActions(params) {
  const { matchUp = {}, sideIndex, drawPosition, callback } = params;

  const sideNumber = sideIndex + 1;
  const { validActions: positionActions } =
    (matchUp.drawId &&
      tournamentEngine.positionActions({
        structureId: matchUp?.structureId,
        matchUpId: matchUp?.matchUpId,
        drawId: matchUp?.drawId,
        drawPosition,
        sideNumber
        /*
      policyDefinitions: {
        ...POLICY_POSITION_ACTIONS_UNRESTRICTED,
        ...(tournamentPolicies?.positionActions && { positionActions: tournamentPolicies?.positionActions }),
        ...{ seeding: tournamentPolicies?.seeding }
      }
      */
      })) ||
    {};

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
  console.log({ params, positionActions, matchUpActions });

  const readyToScore = matchUpActions?.find(({ type }) => type === 'SCORE');
  if (readyToScore) {
    enterMatchUpScore({ matchUpId: readyToScore.payload.matchUpId, callback });
  }
}
