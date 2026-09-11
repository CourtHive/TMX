import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getBuiltinPoliciesMock, loadUserPoliciesMock } = vi.hoisted(() => ({
  getBuiltinPoliciesMock: vi.fn(),
  loadUserPoliciesMock: vi.fn(),
}));

vi.mock('pages/policies/policyBridge', () => ({
  getBuiltinPolicies: getBuiltinPoliciesMock,
  loadUserPolicies: loadUserPoliciesMock,
}));

import {
  ATTACHED_POLICY_ID,
  NO_POLICY_ID,
  PROVIDER_POLICY_ID,
  buildAttachedChoice,
  describeThresholds,
  loadSeedingChoices,
  resolveAttachedChoiceId,
} from './seedingPolicyChoices';
import { providerConfig } from 'config/providerConfig';

/** A federation seeding 16 in a 32 draw — deeper than either policy TMX ships as a preset. */
const DEEP_SEEDING = {
  policyName: 'Deep National',
  seedsCountThresholds: [
    { drawSize: 16, minimumParticipantCount: 12, seedsCount: 8 },
    { drawSize: 32, minimumParticipantCount: 24, seedsCount: 16 },
  ],
};

const BUILTIN_ID = 'builtin-seeding';
const BUILTIN_NAME = 'Default Seeding';

const BUILTIN_SEEDING = {
  id: BUILTIN_ID,
  name: BUILTIN_NAME,
  policyType: 'seeding',
  source: 'builtin',
  policyData: { seedsCountThresholds: [{ drawSize: 32, minimumParticipantCount: 24, seedsCount: 8 }] },
};

beforeEach(() => {
  getBuiltinPoliciesMock.mockReturnValue([BUILTIN_SEEDING, { id: 'sched', policyType: 'scheduling', policyData: {} }]);
  loadUserPoliciesMock.mockResolvedValue([]);
  providerConfig.reset();
});

afterEach(() => {
  providerConfig.reset();
  vi.clearAllMocks();
});

describe('loadSeedingChoices', () => {
  it('offers seeding policies only, plus an explicit "none"', async () => {
    const choices = await loadSeedingChoices();
    expect(choices.map((c) => c.id)).toEqual([BUILTIN_ID, NO_POLICY_ID]);
  });

  it('survives an unreadable catalog rather than returning nothing', async () => {
    loadUserPoliciesMock.mockRejectedValue(new Error('IndexedDB unavailable'));
    const choices = await loadSeedingChoices();
    expect(choices.map((c) => c.id)).toContain(BUILTIN_ID);
  });

  it('leads with the provider policy when one is declared', async () => {
    providerConfig.set({ policies: { seedingPolicy: DEEP_SEEDING } } as any);
    const choices = await loadSeedingChoices();
    expect(choices[0].id).toEqual(PROVIDER_POLICY_ID);
    expect(choices[0].label).toEqual('Deep National');
    // Declaring a policy without restricting the permission is a default, not a rule.
    expect(choices.length).toBeGreaterThan(1);
  });

  it('offers the provider policy ALONE when canModifyPolicies is withheld', async () => {
    providerConfig.set({
      policies: { seedingPolicy: DEEP_SEEDING },
      permissions: { canModifyPolicies: false },
    } as any);
    const choices = await loadSeedingChoices();
    expect(choices.map((c) => c.id)).toEqual([PROVIDER_POLICY_ID]);
  });

  it('does not lock when the permission is withheld but no policy is declared', async () => {
    providerConfig.set({ permissions: { canModifyPolicies: false } } as any);
    expect(providerConfig.isSeedingPolicyLocked()).toEqual(false);
    const choices = await loadSeedingChoices();
    expect(choices.map((c) => c.id)).toEqual([BUILTIN_ID, NO_POLICY_ID]);
  });

  it('stamps an identity so the attached policy can be recognized later', async () => {
    const choices = await loadSeedingChoices();
    expect(choices[0].definition?.seeding.policyName).toEqual(BUILTIN_NAME);
  });
});

describe('resolveAttachedChoiceId', () => {
  it('matches on stamped identity', async () => {
    const choices = await loadSeedingChoices();
    const attached = { ...BUILTIN_SEEDING.policyData, policyName: BUILTIN_NAME };
    expect(resolveAttachedChoiceId(attached, choices)).toEqual(BUILTIN_ID);
  });

  it('falls back to a structural compare for policies attached before stamping existed', async () => {
    const choices = await loadSeedingChoices();
    // No policyName, and key order differs from the catalog entry's.
    const attached = { seedsCountThresholds: [{ seedsCount: 8, minimumParticipantCount: 24, drawSize: 32 }] };
    expect(resolveAttachedChoiceId(attached, choices)).toEqual(BUILTIN_ID);
  });

  it('reports no match for a genuinely different policy', async () => {
    const choices = await loadSeedingChoices();
    expect(resolveAttachedChoiceId(DEEP_SEEDING, choices)).toEqual(null);
  });

  it('reports no match when nothing is attached', async () => {
    expect(resolveAttachedChoiceId(null, await loadSeedingChoices())).toEqual(null);
  });
});

describe('buildAttachedChoice', () => {
  it('names an unmatched attached policy by its own policyName', () => {
    const choice = buildAttachedChoice(DEEP_SEEDING, null);
    expect(choice.id).toEqual(ATTACHED_POLICY_ID);
    expect(choice.label).toEqual('Attached — Deep National');
  });

  it('falls back to Custom policy when the attached policy is anonymous', () => {
    expect(buildAttachedChoice({ seedsCountThresholds: [] }, null).label).toEqual('Attached — Custom policy');
  });
});

describe('describeThresholds', () => {
  it('renders the seeding depth, which a policy name never states', () => {
    expect(describeThresholds(DEEP_SEEDING)).toEqual(['16 → 8', '32 → 16']);
  });

  it('sorts by draw size regardless of how the policy was authored', () => {
    const unsorted = {
      seedsCountThresholds: [
        { drawSize: 64, seedsCount: 32 },
        { drawSize: 4, seedsCount: 2 },
      ],
    };
    expect(describeThresholds(unsorted)).toEqual(['4 → 2', '64 → 32']);
  });

  it('says nothing for a policy with no thresholds', () => {
    expect(describeThresholds({ seedingProfile: { positioning: 'CLUSTER' } })).toEqual([]);
    expect(describeThresholds(null)).toEqual([]);
  });
});
