/**
 * What happens AFTER a topology-built draw is generated: the attach methods the converter deferred.
 *
 * `topologyToDrawOptions` (courthive-components) turns a topology into one `generateDrawDefinition`
 * call plus `postGenerationMethods` for the structures the generator cannot produce in that call — a
 * consolation hung off a node the drawType does not already cover. Since components #657 each method
 * names its SOURCE node (`sourceStage`, `sourceStructureName`) so the consumer can find the generated
 * structure it feeds from. Both consumers (the add-draw drawer's template path and the topology page)
 * used to pin every link to the MAIN structure, which silently lost a qualifying source: the ITA
 * regional's "consolation for the losers of qualifying round 1" came out fed by the main draw. They
 * share this module now, so the resolution cannot drift between them again.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { entryStatusConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

import { ATTACH_CONSOLATION_STRUCTURES, ATTACH_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';

const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;
const { MAIN, QUALIFYING, LOSER, TOP_DOWN } = drawDefinitionConstants;

type Structure = { structureId: string; stage?: string; structureName?: string };

/** The engine surface this module needs, injectable so a unit test can hand in a stub. */
export type PostGenerationEngine = {
  generateConsolationStructure: (params: any) => any;
  generateAndPopulatePlayoffStructures: (params: any) => any;
};

/**
 * The entries a topology-built draw is generated with.
 *
 * MAIN direct entries always; QUALIFYING direct entries only when the topology has a QUALIFYING node
 * to place them in. Measured against factory 7.7.0: with MAIN-only `drawEntries` the generated
 * qualifying structure comes out EMPTY (0 of 64 placed) even though the event holds 64 qualifying
 * entries, because the factory places only the entries it is handed. Without a qualifying node the
 * qualifying entries stay off the draw rather than riding along as entries of a draw that has no
 * stage for them.
 */
export function topologyDrawEntries({ event, state }: { event: any; state: { nodes?: any[] } }): any[] {
  const hasQualifying = (state?.nodes ?? []).some((node: any) => node.stage === QUALIFYING);
  return (event?.entries ?? []).filter(({ entryStage, entryStatus }: any) => {
    if (!DIRECT_ENTRY_STATUSES.includes(entryStatus)) return false;
    if (!entryStage || entryStage === MAIN) return true;
    return hasQualifying && entryStage === QUALIFYING;
  });
}

/**
 * The generated structure a post-generation method's SOURCE node became.
 *
 * By stage and name when the method carries them (components ≥ #657); by stage alone when only one
 * structure of that stage exists or the name did not survive generation; the MAIN structure when the
 * method is untagged (an older converter) — which is exactly what both consumers did unconditionally.
 */
export function resolveSourceStructure(
  structures: Structure[],
  params: { sourceStage?: string; sourceStructureName?: string } | undefined,
): Structure | undefined {
  const main = structures.find((s) => s.stage === MAIN);
  const stage = params?.sourceStage;
  if (!stage) return main;
  const ofStage = structures.filter((s) => s.stage === stage);
  const named = ofStage.find((s) => s.structureName === params?.sourceStructureName);
  return named ?? (ofStage.length === 1 ? ofStage[0] : undefined) ?? (stage === MAIN ? main : undefined);
}

/** The method's generation params without the source tags, which name a node and mean nothing to the engine. */
function withoutSourceTags(params: Record<string, any>): Record<string, any> {
  const { sourceStage: _stage, sourceStructureName: _name, ...rest } = params;
  return rest;
}

/**
 * The attach mutations for one generated draw, ready for `mutationRequest`.
 *
 * Each consolation method is generated locally (the structure with its matchUps) and attached with
 * LOSER links from the resolved source. A method whose source cannot be resolved is skipped and
 * reported in `unresolved`, so the consumer can say which structure did not get built rather than
 * attach it to the wrong one. The playoff branch is kept for a converter that emits one; today's
 * converter folds playoffs into the generation call itself.
 */
export function buildTopologyAttachMethods({
  drawDefinition,
  postGenerationMethods,
  engine = tournamentEngine,
}: {
  drawDefinition: { drawId: string; structures?: Structure[] };
  postGenerationMethods: any[];
  engine?: PostGenerationEngine;
}): { methods: any[]; unresolved: string[] } {
  const structures = drawDefinition.structures ?? [];
  const drawId = drawDefinition.drawId;
  const unresolved: string[] = [];
  const methods: any[] = [];

  for (const pgm of postGenerationMethods ?? []) {
    const params = pgm?.params ?? {};
    const source = resolveSourceStructure(structures, params);
    if (!source) {
      unresolved.push(params.structureName ?? pgm?.method ?? 'unknown');
      continue;
    }

    if (pgm.method === ATTACH_CONSOLATION_STRUCTURES) {
      const { links: linkDefinitions, ...generateParams } = withoutSourceTags(params);
      const generated = engine.generateConsolationStructure(generateParams);
      const consolation = generated?.structures?.[0];
      if (!consolation) {
        unresolved.push(params.structureName ?? ATTACH_CONSOLATION_STRUCTURES);
        continue;
      }
      const links = (linkDefinitions ?? []).map((link: any) => ({
        linkType: LOSER,
        source: { roundNumber: link.sourceRoundNumber, structureId: source.structureId },
        target: { roundNumber: link.targetRoundNumber, feedProfile: TOP_DOWN, structureId: consolation.structureId },
      }));
      methods.push({ method: ATTACH_CONSOLATION_STRUCTURES, params: { drawId, structures: [consolation], links } });
    } else if (pgm.method === ATTACH_PLAYOFF_STRUCTURES) {
      const playoffResult = engine.generateAndPopulatePlayoffStructures({
        ...withoutSourceTags(params),
        drawId,
        structureId: source.structureId,
      });
      if (playoffResult?.error || !playoffResult?.structures?.length) {
        unresolved.push(params.structureName ?? ATTACH_PLAYOFF_STRUCTURES);
        continue;
      }
      methods.push({
        method: ATTACH_PLAYOFF_STRUCTURES,
        params: {
          matchUpModifications: playoffResult.matchUpModifications,
          structures: playoffResult.structures,
          links: playoffResult.links,
          drawId,
        },
      });
    }
  }

  return { methods, unresolved };
}

/**
 * Run the deferred attaches for a generated draw, then `onDone`.
 *
 * `onDone` fires whether or not there was anything to attach, so a consumer's toast-and-navigate lives
 * in one place. `unresolved` names the structures that were NOT attached; the consumer decides how to
 * tell the operator.
 */
export function attachTopologyStructures({
  drawDefinition,
  postGenerationMethods,
  onDone,
  engine,
}: {
  drawDefinition: { drawId: string; structures?: Structure[] };
  postGenerationMethods: any[];
  onDone: (result: { unresolved: string[] }) => void;
  engine?: PostGenerationEngine;
}): void {
  const { methods, unresolved } = buildTopologyAttachMethods({ drawDefinition, postGenerationMethods, engine });
  if (!methods.length) {
    onDone({ unresolved });
    return;
  }
  mutationRequest({ methods, callback: () => onDone({ unresolved }) });
}
