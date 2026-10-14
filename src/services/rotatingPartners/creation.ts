import { ADD_DRAW_DEFINITION, ADD_EVENT_ENTRIES, SET_COMPETITION_PROFILE } from 'constants/mutationConstants';
import type { CompetitionProfile, RotatingPartnerScoringVariant } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import type { MutationMethod } from 'types/services';

export type RotatingFormat = 'AMERICANO' | 'MEXICANO';
export type RotatingCreation = {
  format: RotatingFormat;
  participantIds: string[];
  combinedPointTotal: number;
  rounds: number;
  selectedVariant: RotatingPartnerScoringVariant;
};

export function rotatingProfile(config: RotatingCreation, seed: number): CompetitionProfile {
  const common = {
    version: 1 as const,
    entrantScope: 'INDIVIDUAL' as const,
    matchUpType: 'DOUBLES' as const,
    scoring: { combinedPointTotal: config.combinedPointTotal, selectedVariant: config.selectedVariant },
    standings: { metric: 'SIDE_POINTS' as const, attribution: 'EACH_INDIVIDUAL' as const },
  };
  return config.format === 'AMERICANO'
    ? {
        ...common,
        format: 'AMERICANO',
        pairing: { seed, algorithmVersion: 1 },
        completion: { kind: 'PARTNERSHIP_COVERAGE' },
      }
    : {
        ...common,
        format: 'MEXICANO',
        pairing: { seed, algorithmVersion: 1, groupBy: 'ADJACENT_STANDINGS', partners: 'FIRST_FOURTH_SECOND_THIRD' },
        completion: { kind: 'ROUND_COUNT', rounds: config.rounds },
      };
}

/** Build one replayable batch; preflight validates admission and governing policy before persistence. */
export function prepareRotatingDraw(eventId: string, drawName: string, config: RotatingCreation, seed: number) {
  const count = new Set(config.participantIds).size;
  if (count !== config.participantIds.length || count < 4 || count > 128 || count % 4) {
    return { error: 'roster', methods: [] as MutationMethod[] };
  }
  const result = tournamentEngine.generateDrawDefinition({
    eventId,
    drawName,
    drawType: 'AD_HOC',
    matchUpType: 'DOUBLES',
    drawSize: count,
    drawEntries: [],
    automated: false,
  });
  if (!result.success || !result.drawDefinition)
    return { error: result.info ?? result.error?.message, methods: [] as MutationMethod[] };
  const drawDefinition = result.drawDefinition;
  const drawId = drawDefinition.drawId;
  const methods: MutationMethod[] = [
    { method: ADD_DRAW_DEFINITION, params: { eventId, drawDefinition } },
    { method: SET_COMPETITION_PROFILE, params: { drawId, competitionProfile: rotatingProfile(config, seed) } },
    {
      method: ADD_EVENT_ENTRIES,
      params: { eventId, drawId, participantIds: config.participantIds, entryStatus: 'DIRECT_ACCEPTANCE' },
    },
  ];
  // Preflight mutates its payload objects as well as staged state; keep the replay batch pristine.
  const preview = tournamentEngine.dryRun(structuredClone(methods));
  if (!preview.wouldSucceed)
    return {
      error: preview.results.find((entry) => entry.error)?.info ?? preview.error?.message,
      methods: [] as MutationMethod[],
    };
  return { methods, drawDefinition };
}
