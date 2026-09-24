/**
 * What the draw view needs to know about additional seeds for one participant: whether one can be
 * granted, and whether this participant already holds one.
 *
 * An additional seed is distinct from `SEED_VALUE` ("Assign seed"), which fills a seat the draw
 * already has. This CREATES one, and only where the active seeding policy's `additionalSeeds`
 * allowance says it may: a governing body that protects a returning player adds a seed ALONGSIDE
 * the normal seeds rather than in place of one, so nobody who earned a seeding slot loses it.
 *
 * Kept separate from the popover that presents it, and reaching for nothing but the engine and
 * i18n, so that the rule can be tested without a DOM. The popover module imports tipster and the
 * toast service, which drag in the whole modal stack.
 */
import { tournamentEngine } from 'services/factory/engine';
import { factoryConstants } from 'tods-competition-factory';
import { t } from 'i18n';

import { ADD_ADDITIONAL_SEED } from 'constants/mutationConstants';

const { seedingBasisConstants } = factoryConstants;

/**
 * Bases offered when a policy names none.
 *
 * `RANKING` and `RATING` are excluded because a seed on the ordinary basis is not additional — it
 * is a seed, and the way to have more of those is a deeper `seedsCountThresholds`. Offering them
 * here would invite an operator to record "extra seed, awarded on ranking", which is a sentence
 * that describes a mistake.
 */
export const DEFAULT_BASES = [seedingBasisConstants.PROTECTED_RANKING, seedingBasisConstants.ORGANISER_DISCRETION];

const basisLabelKeys: Record<string, string> = {
  [seedingBasisConstants.ORGANISER_DISCRETION]: 'additionalSeeds.basis.organiserDiscretion',
  [seedingBasisConstants.PROTECTED_RANKING]: 'additionalSeeds.basis.protectedRanking',
  [seedingBasisConstants.RANKING]: 'additionalSeeds.basis.ranking',
  [seedingBasisConstants.RATING]: 'additionalSeeds.basis.rating',
};

export function seedingBasisLabel(basis?: string): string | undefined {
  return basis ? (basisLabelKeys[basis] ? t(basisLabelKeys[basis]) : basis) : undefined;
}

type AdditionalSeedContextArgs = {
  participantId: string;
  structureId: string;
  drawId: string;
};

export type AdditionalSeedContext = {
  /** Present when this seed already carries a non-ordinary basis; for display, not for action. */
  basisLabel?: string;
  /** Present when the structure can take another additional seed and this participant is unseeded. */
  action?: any;
};

/**
 * What the position popover needs to know about additional seeds for one participant: whether one
 * can be granted, and whether this participant already holds one.
 *
 * Both answers come from the same pair of reads, deliberately. The popover opens on a click, so a
 * second round of engine calls to answer the display half would be two reads of the same structure
 * that could disagree with each other.
 *
 * The allowance is read through `getAdditionalSeedsAllowance` rather than inferred from the policy,
 * because `addAdditionalSeed` applies the same arithmetic on the way in — a control that offers
 * what the mutation will refuse is worse than no control.
 */
export function getAdditionalSeedContext({
  participantId,
  structureId,
  drawId,
}: AdditionalSeedContextArgs): AdditionalSeedContext {
  if (!participantId || !structureId || !drawId) return {};

  const { seedAssignments }: any = tournamentEngine.getStructureSeedAssignments({ structureId, drawId }) ?? {};
  const existing = (seedAssignments ?? []).find((assignment: any) => assignment.participantId === participantId);

  // An absent basis means RANKING — "the ordinary one", not "unknown" — so there is nothing worth
  // saying about it. Labelling every seed "Ranking" would bury the one that is not.
  const basisLabel =
    existing?.seedingBasis && existing.seedingBasis !== seedingBasisConstants.RANKING
      ? t('additionalSeeds.seededOn', { basis: seedingBasisLabel(existing.seedingBasis) })
      : undefined;

  // Someone already seeded cannot be seeded again; the factory clears their prior seedNumber if
  // asked, which would take a seat away from the draw to hand the same person another.
  if (existing) return { basisLabel };

  const allowance: any = tournamentEngine.getAdditionalSeedsAllowance({ structureId, drawId });
  if (allowance?.error || !allowance?.additionalSeedsRemaining) return { basisLabel };

  return {
    basisLabel,
    action: {
      payload: { participantId, structureId, drawId },
      bases: allowance.bases?.length ? allowance.bases : DEFAULT_BASES,
      remaining: allowance.additionalSeedsRemaining,
      seedNumber: (allowance.seedLimit ?? 0) + 1,
      method: ADD_ADDITIONAL_SEED,
      type: 'ADDITIONAL_SEED',
    },
  };
}
