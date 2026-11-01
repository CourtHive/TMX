/**
 * Placing qualifiers: every qualified participant goes into the main draw's open qualifier positions at once, by lot.
 *
 * The qualifier positions are fixed when the main draw is made; once qualifying ends the qualifiers are drawn into
 * them by lot, never simply in order. The lot is drawn here, once, and travels in the mutation's params
 * (`randomList`), so the server and this client place every qualifier in the same position.
 *
 * Pure: the engine is passed in, so the rules are tested against the real factory without any UI.
 */
import { drawDefinitionConstants, tools } from 'tods-competition-factory';

// constants
import { QUALIFIER_PROGRESSION } from 'constants/mutationConstants';

const { MAIN, QUALIFYING } = drawDefinitionConstants;

// the factory's position action type for placing a qualified participant (positionActionConstants.QUALIFYING_PARTICIPANT)
const QUALIFIER_ACTION = 'QUALIFIER';

type Engine = { [method: string]: any };

export type QualifierPlacementState = {
  qualifiedParticipantIds: string[];
  openQualifierPositions: number[];
  hasLinkedQualifying: boolean;
  mainStructureId?: string;
  eligible: boolean;
};

const NOT_ELIGIBLE: QualifierPlacementState = {
  qualifiedParticipantIds: [],
  openQualifierPositions: [],
  hasLinkedQualifying: false,
  eligible: false,
};

/**
 * Whether "Place qualifiers" applies to a draw: a qualifying structure feeds the main structure, the main structure
 * has open qualifier positions, and at least one qualified participant is not placed yet.
 *
 * Who counts as qualified is the factory's answer, not a TMX approximation: the qualifier action that
 * `positionActions` offers on each open qualifier position lists the qualified participants not yet placed.
 */
export function getQualifierPlacementState({
  engine,
  drawId,
  eventId,
}: {
  engine: Engine;
  drawId: string;
  eventId?: string;
}): QualifierPlacementState {
  const drawDefinition = engine.getEvent({ drawId })?.drawDefinition;
  const structures: any[] = drawDefinition?.structures ?? [];
  const mainStructure = structures.find(({ stage, stageSequence }) => stage === MAIN && stageSequence === 1);
  if (!mainStructure) return NOT_ELIGIBLE;

  const mainStructureId = mainStructure.structureId;
  const qualifyingStructureIds = new Set(
    structures.filter(({ stage }) => stage === QUALIFYING).map(({ structureId }) => structureId),
  );
  const hasLinkedQualifying = (drawDefinition?.links ?? []).some(
    (link: any) =>
      link?.target?.structureId === mainStructureId && qualifyingStructureIds.has(link?.source?.structureId),
  );

  const positionAssignments: any[] =
    engine.getPositionAssignments({ structureId: mainStructureId, drawId })?.positionAssignments ?? [];
  const openQualifierPositions = positionAssignments
    .filter((assignment) => assignment.qualifier && !assignment.participantId)
    .map(({ drawPosition }) => drawPosition);

  const qualifiedParticipantIds: string[] = [];
  if (hasLinkedQualifying) {
    for (const drawPosition of openQualifierPositions) {
      const { validActions } =
        engine.positionActions({ structureId: mainStructureId, drawPosition, eventId, drawId }) ?? {};
      const qualifierAction = validActions?.find(({ type }: any) => type === QUALIFIER_ACTION);
      for (const participantId of qualifierAction?.qualifyingParticipantIds ?? []) {
        if (!qualifiedParticipantIds.includes(participantId)) qualifiedParticipantIds.push(participantId);
      }
    }
  }

  return {
    eligible: hasLinkedQualifying && openQualifierPositions.length > 0 && qualifiedParticipantIds.length > 0,
    qualifiedParticipantIds,
    openQualifierPositions,
    hasLinkedQualifying,
    mainStructureId,
  };
}

/** The lot: a random ordering of the qualifier position indexes, which `mapNumbersToIndexes` uses as given. */
export function drawQualifierLot(positionsCount: number, shuffle: (values: number[]) => number[] = tools.shuffleArray) {
  return shuffle(tools.generateRange(0, positionsCount));
}

export function buildPlaceQualifiersMethod({
  positionsCount,
  eventId,
  drawId,
  shuffle,
}: {
  shuffle?: (values: number[]) => number[];
  positionsCount: number;
  eventId?: string;
  drawId: string;
}) {
  const randomList = drawQualifierLot(positionsCount, shuffle);
  return { method: QUALIFIER_PROGRESSION, params: tools.definedAttributes({ drawId, eventId, randomList }) };
}

export type QualifierPlacementSummary = {
  placed: { participantId: string; participantName: string; drawPosition: number }[];
  notPlaced: { participantId: string; participantName: string }[];
  openPositionsRemaining: number;
  incomplete: boolean;
};

/**
 * What the TD is told afterwards: who went where, and whether some could not be placed. The method succeeds even
 * when it skips placements, so fewer placed than were qualified, or than there were positions, is reported here.
 */
export function summarizeQualifierPlacement({
  qualifiedParticipantIds,
  positionsCount,
  result,
  getName,
}: {
  getName: (participantId: string) => string | undefined;
  qualifiedParticipantIds: string[];
  positionsCount: number;
  result: any;
}): QualifierPlacementSummary {
  const assigned: { participantId: string; drawPosition: number }[] = findAssignedParticipants(result);
  const placedIds = new Set(assigned.map(({ participantId }) => participantId));
  const nameOf = (participantId: string) => getName(participantId) ?? participantId;

  const placed = [...assigned]
    .sort((a, b) => a.drawPosition - b.drawPosition)
    .map(({ participantId, drawPosition }) => ({
      participantId,
      participantName: nameOf(participantId),
      drawPosition,
    }));
  const notPlaced = qualifiedParticipantIds
    .filter((participantId) => !placedIds.has(participantId))
    .map((participantId) => ({ participantId, participantName: nameOf(participantId) }));
  const openPositionsRemaining = Math.max(0, positionsCount - placed.length);

  return { placed, notPlaced, openPositionsRemaining, incomplete: notPlaced.length > 0 || openPositionsRemaining > 0 };
}

// executionQueue returns each method's result in `results`; a direct call returns it at the top level
function findAssignedParticipants(result: any) {
  if (Array.isArray(result?.assignedParticipants)) return result.assignedParticipants;
  const fromResults = (result?.results ?? []).find((r: any) => Array.isArray(r?.assignedParticipants));
  return fromResults?.assignedParticipants ?? [];
}
