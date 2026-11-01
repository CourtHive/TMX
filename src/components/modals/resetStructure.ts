/**
 * Resetting ONE structure's results: a qualifying structure or a consolation, while the rest of the draw stands.
 *
 * The factory decides what may be reset (`resetStructure`): it refuses the first main structure while it is linked to
 * others, which is reset with the whole draw, and a structure that has already delivered a participant through one of
 * its links, such as qualifying whose qualifiers are placed in the main draw. The menu hides only what the factory would
 * always refuse, and a refusal is shown as the factory gives it.
 *
 * Lives in its own module so it can be tested without importing the modal, which pulls courthive-components.
 */
import { drawDefinitionConstants, errorConditionConstants } from 'tods-competition-factory';
import { RESET_STRUCTURE } from 'constants/mutationConstants';

const { CANNOT_RESET_STRUCTURE } = errorConditionConstants;
const { MAIN } = drawDefinitionConstants;

/** Offered for a structure holding a result, except a first main structure linked to others. */
export function canOfferStructureReset({
  drawDefinition,
  structureId,
  hasResults,
}: {
  drawDefinition: any;
  structureId: string;
  hasResults: boolean;
}): boolean {
  const structure = drawDefinition?.structures?.find((structure: any) => structure.structureId === structureId);
  if (!structure || !hasResults) return false;
  const isFirstMain = structure.stage === MAIN && structure.stageSequence === 1;
  const isLinked = (drawDefinition.links ?? []).some(({ source, target }: any) =>
    [source?.structureId, target?.structureId].includes(structureId),
  );
  return !(isFirstMain && isLinked);
}

/** Whether any matchUp of the structure (or of its groups, for a round robin) holds a result: a winner or a score. */
export function structureHasResults({ matchUps, structureId }: { matchUps: any[]; structureId: string }): boolean {
  return (matchUps ?? []).some(
    (matchUp: any) =>
      [matchUp.structureId, matchUp.containerStructureId].includes(structureId) &&
      (matchUp.winningSide || matchUp.score?.scoreStringSide1),
  );
}

export function resetStructureMethod({
  structureId,
  auditData,
  drawId,
}: {
  structureId: string;
  auditData?: any;
  drawId: string;
}): any {
  return { method: RESET_STRUCTURE, params: { drawId, structureId, auditData, removeScheduling: true } };
}

/** The i18n key explaining a refusal, when the factory refused because of the draw's links. */
export function structureResetRefusalKey(result: any): string | undefined {
  if (result?.error?.code !== CANNOT_RESET_STRUCTURE.code) return undefined;
  return result.context?.delivered?.length ? 'drawActions.resetStructureDelivered' : 'drawActions.resetStructureLinked';
}
