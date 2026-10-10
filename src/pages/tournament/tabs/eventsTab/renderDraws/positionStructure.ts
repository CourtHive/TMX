/**
 * Positions a structure that was generated before its entries (a shell): the entries present now, the
 * qualifier positions and the BYEs, with seeds chosen now from the event's seeding within the seeding policy.
 *
 * The positioning is random, so it runs once, here, and the mutation carries its result (positions and seeds)
 * for the server and this client to replay alike.
 */
import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';

// constants
import { SET_POSITION_ASSIGNMENTS } from 'constants/mutationConstants';

const { MAIN } = drawDefinitionConstants;

type PositionStructureParams = {
  onPositioned: () => void;
  structureId: string;
  eventId: string;
  drawId: string;
  stage?: string;
};

export function positionStructure({
  stage = MAIN,
  structureId,
  eventId,
  drawId,
  onPositioned,
}: PositionStructureParams) {
  const drawDefinition = tournamentEngine.q.drawDefinition({ drawId });
  const accepted = acceptedEntryStatuses(stage);
  const participantsCount = (drawDefinition?.entries ?? []).filter(({ entryStage = MAIN, entryStatus }: any) =>
    accepted.includes(`${entryStage}.${entryStatus}`),
  ).length;
  const drawSize = tournamentEngine.getPositionAssignments({ structureId, drawId }).positionAssignments?.length ?? 0;
  const seedsCount = tournamentEngine.getSeedsCount({ participantsCount, drawSize, drawId })?.seedsCount ?? 0;

  const result = tournamentEngine.automatedPositioning({
    seedingScaleName: eventId,
    applyPositioning: false,
    structureId,
    seedsCount,
    drawId,
  });

  if (!result.success || !result.positionAssignments?.length) {
    tmxToast({ message: result.error?.message || 'No position assignments generated', intent: 'is-warning' });
    return;
  }

  const { positionAssignments, seedAssignments } = result;
  const methods = [
    {
      method: SET_POSITION_ASSIGNMENTS,
      params: {
        structurePositionAssignments: [{ structureId, positionAssignments, seedAssignments }],
        structureId,
        drawId,
      },
    },
  ];

  const postMutation = (mutationResult: any) => {
    if (mutationResult.success) {
      onPositioned();
    } else {
      tmxToast({ message: mutationResult.error?.message || 'Failed to place participants', intent: 'is-danger' });
    }
  };

  mutationRequest({ methods, callback: postMutation });
}
