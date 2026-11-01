/**
 * Resetting one structure, through the real engine: offered for a qualifying or consolation structure with results,
 * never for a first main structure linked to others; the factory's refusal names why.
 */
import {
  canOfferStructureReset,
  resetStructureMethod,
  structureHasResults,
  structureResetRefusalKey,
} from './resetStructure';
import { drawDefinitionConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

const { CONSOLATION, FEED_IN_CHAMPIONSHIP, MAIN, QUALIFYING } = drawDefinitionConstants;

const drawDefinitionOf = (drawId: string) => tournamentEngine.getEvent({ drawId }).drawDefinition;
const structureIdOf = (drawId: string, stage: string) =>
  drawDefinitionOf(drawId).structures.find((structure: any) => structure.stage === stage).structureId;
const statusesOf = (stage: string) =>
  tournamentEngine
    .allTournamentMatchUps()
    .matchUps.filter((matchUp: any) => matchUp.stage === stage)
    .map(({ matchUpStatus }: any) => matchUpStatus);

function reset(drawId: string, structureId: string) {
  return tournamentEngine.executionQueue([resetStructureMethod({ drawId, structureId })]);
}

describe('reset structure', () => {
  it('resets a consolation and is never offered for the main structure that feeds it', () => {
    const {
      drawIds: [drawId],
    } = mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 8, drawType: FEED_IN_CHAMPIONSHIP }],
      completeAllMatchUps: true,
      setState: true,
    });
    const drawDefinition = drawDefinitionOf(drawId);
    const mainId = structureIdOf(drawId, MAIN);
    const consolationId = structureIdOf(drawId, CONSOLATION);

    expect(canOfferStructureReset({ drawDefinition, structureId: mainId, hasResults: true })).toEqual(false);
    expect(canOfferStructureReset({ drawDefinition, structureId: consolationId, hasResults: false })).toEqual(false);
    expect(canOfferStructureReset({ drawDefinition, structureId: consolationId, hasResults: true })).toEqual(true);

    const drawMatchUps = () => tournamentEngine.allDrawMatchUps({ drawId, inContext: true }).matchUps;
    expect(structureHasResults({ matchUps: drawMatchUps(), structureId: consolationId })).toEqual(true);

    const mainBefore = statusesOf(MAIN);
    const result: any = reset(drawId, consolationId);
    expect(result.success).toEqual(true);
    expect(structureHasResults({ matchUps: drawMatchUps(), structureId: consolationId })).toEqual(false);
    expect(statusesOf(CONSOLATION).every((status: string) => status === 'TO_BE_PLAYED')).toEqual(true);
    expect(statusesOf(MAIN)).toEqual(mainBefore);

    // the factory's own refusal, had the menu offered it
    expect(structureResetRefusalKey(reset(drawId, mainId))).toEqual('drawActions.resetStructureLinked');
  });

  it('refuses qualifying once its qualifiers are placed in the main draw, and names why', () => {
    const {
      drawIds: [drawId],
    } = mocksEngine.generateTournamentRecord({
      drawProfiles: [
        {
          drawSize: 16,
          qualifyingProfiles: [
            { roundTarget: 1, structureProfiles: [{ stageSequence: 1, drawSize: 8, qualifyingPositions: 2 }] },
          ],
        },
      ],
      completeAllMatchUps: true,
      setState: true,
    });
    const drawDefinition = drawDefinitionOf(drawId);
    const qualifyingId = structureIdOf(drawId, QUALIFYING);
    expect(canOfferStructureReset({ drawDefinition, structureId: qualifyingId, hasResults: true })).toEqual(true);

    let result: any = tournamentEngine.qualifierProgression({ drawId });
    expect(result.assignedParticipants?.length).toEqual(2);

    result = reset(drawId, qualifyingId);
    expect(result.success).not.toEqual(true);
    expect(structureResetRefusalKey(result)).toEqual('drawActions.resetStructureDelivered');
    expect(structureResetRefusalKey({ success: true })).toBeUndefined();
  });
});
