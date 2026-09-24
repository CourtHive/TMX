/**
 * The seeding policy the draw form is working against, and what it permits.
 *
 * Extracted from `submitDrawParams` so the seed-count `<select>` and the submission agree about
 * which policy is in force. They did not previously need to: the form's option list was shaped
 * purely by the structure, because any explicit count was an override of the policy. Once a policy
 * can PERMIT counts above its own threshold, the list has to be built from the policy too, and two
 * copies of "which policy is this" would be two things to drift.
 */
import { factoryConstants, policyComposer, policyConstants, drawDefinitionConstants } from 'tods-competition-factory';

import { tournamentEngine } from 'services/factory/engine';
import { providerConfig } from 'config/providerConfig';
import POLICY_SEEDING from 'assets/policies/seedingPolicy';

const { POLICY_TYPE_SEEDING } = policyConstants;
const { ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF, SEPARATE, CLUSTER } = drawDefinitionConstants;

export const INHERIT = 'INHERIT';

// Seeding policy definitions matching factory defaults.
//
// USTA is the base — written as a plain object literal so the shape reads as "this is the stock
// policy". ITF derives from USTA via `policyComposer` so the delta is explicit and discoverable:
// change positioning, drop the draw-type overrides, bump one threshold's minimumParticipantCount.
export const POLICY_SEEDING_DEFAULT = {
  [POLICY_TYPE_SEEDING]: {
    validSeedPositions: { ignore: true },
    duplicateSeedNumbers: true,
    drawSizeProgression: true,
    seedingProfile: {
      drawTypes: {
        [ROUND_ROBIN_WITH_PLAYOFF]: { positioning: factoryConstants.drawDefinitionConstants.WATERFALL },
        [ROUND_ROBIN]: { positioning: factoryConstants.drawDefinitionConstants.WATERFALL },
      },
      positioning: SEPARATE,
    },
    policyName: 'USTA SEEDING',
    seedsCountThresholds: [
      { drawSize: 4, minimumParticipantCount: 3, seedsCount: 2 },
      { drawSize: 16, minimumParticipantCount: 12, seedsCount: 4 },
      { drawSize: 32, minimumParticipantCount: 24, seedsCount: 8 },
      { drawSize: 64, minimumParticipantCount: 48, seedsCount: 16 },
      { drawSize: 128, minimumParticipantCount: 96, seedsCount: 32 },
      { drawSize: 256, minimumParticipantCount: 192, seedsCount: 64 },
    ],
  },
};

export const POLICY_SEEDING_ITF = policyComposer(POLICY_TYPE_SEEDING)
  .extend(POLICY_SEEDING_DEFAULT)
  .set('policyName', 'ITF SEEDING')
  .set('seedingProfile.positioning', CLUSTER)
  .unset('seedingProfile.drawTypes')
  .set('seedsCountThresholds.4.minimumParticipantCount', 97)
  .build();

export function getSeedingPolicyDefinition(selectedSeedingPolicy: string): any {
  // A locked provider policy is passed explicitly rather than left to INHERIT. Inheriting requires
  // someone to have attached it on the settings tab first, and a draw created before anyone did
  // would generate silently non-compliant — the one failure mode a locked policy exists to prevent.
  // Attaching it as well is not a conflict: same policy, same seeding.
  if (providerConfig.isSeedingPolicyLocked()) {
    const providerPolicy = providerConfig.getSeedingPolicy();
    if (providerPolicy) return { [POLICY_TYPE_SEEDING]: providerPolicy };
  }
  if (selectedSeedingPolicy === SEPARATE) {
    return POLICY_SEEDING_DEFAULT;
  } else if (selectedSeedingPolicy === CLUSTER) {
    return POLICY_SEEDING_ITF;
  } else if (selectedSeedingPolicy === INHERIT) {
    return undefined;
  }
  return POLICY_SEEDING_DEFAULT;
}

type SeedingAllowanceArgs = {
  selectedSeedingPolicy?: string;
  participantsCount: number;
  drawSize: number;
  eventId?: string;
};

export type SeedingAllowance = {
  additionalSeedsAllowed: number;
  thresholdSeedsCount: number;
};

/**
 * What the policy in force yields for this draw size, and how far above it the policy permits going.
 *
 * INHERIT deliberately passes NO `policyDefinitions` and lets the factory resolve whatever is
 * attached to the event or tournament. That is the only way the form can see an `additionalSeeds`
 * allowance declared by a provider or governing-body policy — substituting the TMX default asset
 * would report an allowance of 0 and quietly hide the feature from exactly the operators it exists
 * for.
 *
 * That resolution only became possible in factory 7.x: `getSeedsCount` called `getPolicyDefinitions`
 * without `policyTypes`, so it answered INVALID_POLICY_DEFINITION for every caller that did not
 * hand it the policy it was being asked about. Falling back to the default asset on error keeps the
 * form working against an older factory and against a tournament with nothing attached.
 */
export function getSeedingAllowance({
  selectedSeedingPolicy,
  participantsCount,
  drawSize,
  eventId,
}: SeedingAllowanceArgs): SeedingAllowance {
  const none = { additionalSeedsAllowed: 0, thresholdSeedsCount: 0 };
  if (!Number.isFinite(drawSize) || drawSize < 2) return none;

  const policyDefinitions = getSeedingPolicyDefinition(selectedSeedingPolicy ?? INHERIT);

  const ask = (definitions?: any) =>
    tournamentEngine.getSeedsCount({
      ...(definitions ? { policyDefinitions: definitions } : { eventId }),
      drawSizeProgression: true,
      participantsCount,
      drawSize,
    });

  const result = ask(policyDefinitions) ?? {};
  const resolved = result.error && !policyDefinitions ? (ask(POLICY_SEEDING) ?? {}) : result;

  return {
    additionalSeedsAllowed: resolved.additionalSeedsAllowed ?? 0,
    thresholdSeedsCount: resolved.seedsCount ?? 0,
  };
}
