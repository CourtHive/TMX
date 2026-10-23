import { drawDefinitionConstants, tools } from 'tods-competition-factory';

const { LOSER } = drawDefinitionConstants;

/**
 * The links that feed an AD_HOC target structure: its LOSER links, and the finishing-position link that carries a
 * round robin's group finishers into it. A link out of a round robin is a finishing-position link whether it is
 * labelled POSITION or WINNER (CA, 2026-10-23); the factory's predicate decides, with the draw so it can see the
 * source structure. A WINNER link out of an elimination structure is a round link and feeds nothing here.
 */
export function findAdHocFeedingLinks(drawDefinition: any, structureId?: string) {
  const inbound = (drawDefinition?.links ?? []).filter((link: any) => link?.target?.structureId === structureId);
  return {
    loserLinks: inbound.filter((link: any) => link.linkType === LOSER),
    positionLink: inbound.find((link: any) => tools.traversesByFinishingPosition(link, drawDefinition)),
  };
}
