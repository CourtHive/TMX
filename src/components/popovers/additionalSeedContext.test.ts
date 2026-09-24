import { factoryConstants, fixtures, mocksEngine, policyConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { describe, expect, it } from 'vitest';

import { getAdditionalSeedContext } from './additionalSeedContext';

const { POLICY_TYPE_SEEDING } = policyConstants;
const { seedingBasisConstants } = factoryConstants;
const ITF = fixtures.policies.POLICY_SEEDING_ITF;

// POLICY_SEEDING_ITF yields 8 seeds at drawSize 32 with 24+ participants. An `additionalSeeds`
// allowance lets a governing body permit seeds ABOVE that, so a protected ranking is seeded
// alongside the eight rather than in place of one of them.
const withAllowance = (maxCount: number, bases?: string[]) => ({
  [POLICY_TYPE_SEEDING]: {
    ...ITF[POLICY_TYPE_SEEDING],
    additionalSeeds: { maxCount, ...(bases ? { bases } : {}) },
  },
});

function setup({ policyDefinitions, seedsCount = 8 }: any) {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ policyDefinitions, participantsCount: 32, drawSize: 32, seedsCount }],
  });
  tournamentEngine.setState(tournamentRecord);
  const drawId = tournamentRecord.events?.[0]?.drawDefinitions?.[0]?.drawId;
  const structure: any = tournamentEngine.getEvent({ drawId }).drawDefinition.structures[0];
  const structureId = structure.structureId;
  const seeded = structure.seedAssignments.map((assignment: any) => assignment.participantId);
  const unseeded = structure.positionAssignments
    .map((assignment: any) => assignment.participantId)
    .filter(Boolean)
    .find((participantId: string) => !seeded.includes(participantId));
  return { drawId, structureId, seeded, unseeded, structure };
}

describe('getAdditionalSeedContext', () => {
  it('offers the action when the policy has room and the participant is unseeded', () => {
    const { drawId, structureId, unseeded } = setup({ policyDefinitions: withAllowance(2) });
    const { action } = getAdditionalSeedContext({ participantId: unseeded, structureId, drawId });
    expect(action?.type).toEqual('ADDITIONAL_SEED');
    expect(action?.seedNumber).toEqual(9);
    expect(action?.remaining).toEqual(2);
  });

  it('offers nothing when the policy declares no allowance', () => {
    const { drawId, structureId, unseeded } = setup({ policyDefinitions: ITF });
    expect(getAdditionalSeedContext({ participantId: unseeded, structureId, drawId }).action).toBeUndefined();
  });

  it('offers nothing once the allowance is spent', () => {
    const { drawId, structureId, unseeded } = setup({ policyDefinitions: withAllowance(1), seedsCount: 9 });
    expect(getAdditionalSeedContext({ participantId: unseeded, structureId, drawId }).action).toBeUndefined();
  });

  it('offers nothing to someone already seeded', () => {
    // Seeding them again would clear their existing seedNumber — taking a seat away from the draw
    // to hand the same person another, which is the opposite of what an additional seed is.
    const { drawId, structureId, seeded } = setup({ policyDefinitions: withAllowance(2) });
    expect(getAdditionalSeedContext({ participantId: seeded[0], structureId, drawId }).action).toBeUndefined();
  });

  it('carries the policy-declared bases through to the popover', () => {
    const { drawId, structureId, unseeded } = setup({
      policyDefinitions: withAllowance(2, [seedingBasisConstants.PROTECTED_RANKING]),
    });
    const { action } = getAdditionalSeedContext({ participantId: unseeded, structureId, drawId });
    expect(action?.bases).toEqual([seedingBasisConstants.PROTECTED_RANKING]);
  });

  it('falls back to the bases that make sense when the policy names none', () => {
    // RANKING and RATING are excluded: a seed on the ordinary basis is not additional, and
    // recording "extra seed, awarded on ranking" would describe a mistake.
    const { drawId, structureId, unseeded } = setup({ policyDefinitions: withAllowance(2) });
    const { action } = getAdditionalSeedContext({ participantId: unseeded, structureId, drawId });
    expect(action?.bases).toEqual([
      seedingBasisConstants.PROTECTED_RANKING,
      seedingBasisConstants.ORGANISER_DISCRETION,
    ]);
  });

  it('reports the basis of a seed that already has one', () => {
    const { drawId, structureId, unseeded } = setup({ policyDefinitions: withAllowance(2) });
    tournamentEngine.addAdditionalSeed({
      seedingBasis: seedingBasisConstants.PROTECTED_RANKING,
      participantId: unseeded,
      structureId,
      drawId,
    });

    const context = getAdditionalSeedContext({ participantId: unseeded, structureId, drawId });
    expect(context.basisLabel).toEqual('Seeded on Protected ranking');
    // and they can no longer be given another
    expect(context.action).toBeUndefined();
  });

  it('says nothing about an ordinary seed', () => {
    // An absent basis means RANKING, not "unknown". Labelling every seed would bury the one that
    // is not ordinary, which is the only reason the label exists.
    const { drawId, structureId, seeded } = setup({ policyDefinitions: withAllowance(2) });
    expect(getAdditionalSeedContext({ participantId: seeded[0], structureId, drawId }).basisLabel).toBeUndefined();
  });

  it('offers nothing without the identifiers it needs', () => {
    expect(getAdditionalSeedContext({ participantId: '', structureId: 's', drawId: 'd' })).toEqual({});
  });
});
