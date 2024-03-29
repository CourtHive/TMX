import { drawDefinitionConstants, policyConstants, scaleConstants } from 'tods-competition-factory';

const { POLICY_TYPE_SEEDING } = policyConstants;
const { SEPARATE } = drawDefinitionConstants;
const { SEEDING } = scaleConstants;

export const POLICY_SEEDING = {
  [POLICY_TYPE_SEEDING]: {
    validSeedPositions: { ignore: true },
    duplicateSeedNumbers: true,
    drawSizeProgression: true,
    seedingProfile: SEPARATE,
    policyName: SEEDING,

    seedsCountThresholds: [
      { drawSize: 4, minimumParticipantCount: 3, seedsCount: 2 },
      { drawSize: 16, minimumParticipantCount: 12, seedsCount: 4 },
      { drawSize: 32, minimumParticipantCount: 24, seedsCount: 8 },
      { drawSize: 64, minimumParticipantCount: 48, seedsCount: 16 },
      { drawSize: 128, minimumParticipantCount: 96, seedsCount: 32 },
      { drawSize: 256, minimumParticipantCount: 192, seedsCount: 64 }
    ]
  }
};

export default POLICY_SEEDING;
