/**
 * Coverage for the shared scheduling-policy selection helpers behind the
 * Apply Times / Apply Grid modals.
 *
 * The load-bearing behaviors under test:
 *   1. normalizedFingerprint — key-order & policyName independence, and that
 *      genuinely different shapes still differ (the honest stopgap boundary).
 *   2. Identity stamping — toDefinition/choiceIdentity carry a policyName so it
 *      travels with the tournamentRecord.
 *   3. resolveAttachedChoiceId — identity match first, structural fallback, and
 *      the drift case that resolves to "no match" (→ Custom / Attached entry).
 *   4. buildAttachedChoice — label precedence and no-re-attach sentinel id.
 *
 * DOM assembly (appendChoiceGroup, openApply*Modal) is intentionally NOT tested
 * here: the vitest env is node, and Playwright is the ecosystem's DOM layer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findPolicyMock, getBuiltinPoliciesMock, loadUserPoliciesMock } = vi.hoisted(() => ({
  findPolicyMock: vi.fn(),
  getBuiltinPoliciesMock: vi.fn(),
  loadUserPoliciesMock: vi.fn(),
}));

vi.mock('services/factory/engine', () => ({
  competitionEngine: { findPolicy: findPolicyMock },
}));

vi.mock('pages/policies/policyBridge', () => ({
  getBuiltinPolicies: getBuiltinPoliciesMock,
  loadUserPolicies: loadUserPoliciesMock,
}));

import {
  ATTACHED_POLICY_ID,
  POLICY_TYPE_SCHEDULING,
  buildAttachedChoice,
  choiceIdentity,
  getAttachedSchedulingPolicy,
  loadSchedulingChoices,
  normalizedFingerprint,
  resolveAttachedChoiceId,
  toChoice,
  toDefinition,
} from './schedulingPolicyChoices';

const BUILTIN_ID = 'builtin-scheduling';
const BUILTIN_NAME = 'Default Scheduling';

const builtinItem = (over: Record<string, any> = {}) => ({
  id: BUILTIN_ID,
  name: BUILTIN_NAME,
  policyType: POLICY_TYPE_SCHEDULING,
  source: 'builtin' as const,
  description: '',
  policyData: { defaultDailyLimits: { total: 3, SINGLES: 2, DOUBLES: 2 } },
  ...over,
});

const userItem = (over: Record<string, any> = {}) => ({
  id: 'user-1',
  name: 'My Policy',
  policyType: POLICY_TYPE_SCHEDULING,
  source: 'user' as const,
  description: '',
  policyData: { defaultDailyLimits: { total: 4 } },
  ...over,
});

beforeEach(() => {
  findPolicyMock.mockReset();
  getBuiltinPoliciesMock.mockReset();
  loadUserPoliciesMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizedFingerprint', () => {
  it('is independent of key ordering', () => {
    const a = { defaultDailyLimits: { total: 3, SINGLES: 2 }, defaultTimes: { minutes: 90 } };
    const b = { defaultTimes: { minutes: 90 }, defaultDailyLimits: { SINGLES: 2, total: 3 } };
    expect(normalizedFingerprint(a)).toBe(normalizedFingerprint(b));
  });

  it('ignores policyName (identity is matched separately)', () => {
    const bare = { defaultDailyLimits: { total: 3 } };
    const stamped = { defaultDailyLimits: { total: 3 }, policyName: BUILTIN_NAME };
    expect(normalizedFingerprint(stamped)).toBe(normalizedFingerprint(bare));
  });

  it('distinguishes genuinely different shapes (the stopgap boundary)', () => {
    const withField = { defaultDailyLimits: { total: 3 }, allowModificationWhenMatchUpsScheduled: { courts: false } };
    const without = { defaultDailyLimits: { total: 3 } };
    expect(normalizedFingerprint(withField)).not.toBe(normalizedFingerprint(without));
  });

  it('distinguishes differing scalar values and array order', () => {
    expect(normalizedFingerprint({ total: 3 })).not.toBe(normalizedFingerprint({ total: 4 }));
    expect(normalizedFingerprint({ a: [1, 2] })).not.toBe(normalizedFingerprint({ a: [2, 1] }));
  });

  it('returns empty string for null / undefined / non-object', () => {
    expect(normalizedFingerprint(null)).toBe('');
    expect(normalizedFingerprint(undefined)).toBe('');
    expect(normalizedFingerprint(42 as any)).toBe('');
  });
});

describe('choiceIdentity / toDefinition', () => {
  it('uses the catalog name when policyData has no embedded policyName', () => {
    expect(choiceIdentity(builtinItem())).toBe(BUILTIN_NAME);
  });

  it('prefers an embedded policyName over the catalog name', () => {
    const item = builtinItem({ name: 'Display Name', policyData: { total: 3, policyName: 'Embedded' } });
    expect(choiceIdentity(item)).toBe('Embedded');
  });

  it('stamps the identity into the wrapped definition', () => {
    const def = toDefinition(builtinItem());
    expect(def[POLICY_TYPE_SCHEDULING].policyName).toBe(BUILTIN_NAME);
    expect(def[POLICY_TYPE_SCHEDULING].defaultDailyLimits).toEqual({ total: 3, SINGLES: 2, DOUBLES: 2 });
  });

  it('does not mutate the source policyData', () => {
    const item = builtinItem();
    toDefinition(item);
    expect(item.policyData).not.toHaveProperty('policyName');
  });
});

describe('toChoice', () => {
  it('maps a builtin catalog item to a stamped, sourced choice', () => {
    const choice = toChoice(builtinItem());
    expect(choice).toMatchObject({ id: BUILTIN_ID, label: BUILTIN_NAME, source: 'builtin' });
    expect(choice.definition[POLICY_TYPE_SCHEDULING].policyName).toBe(BUILTIN_NAME);
  });

  it('maps any non-builtin source to "user"', () => {
    expect(toChoice(userItem({ source: 'imported' })).source).toBe('user');
  });
});

describe('resolveAttachedChoiceId', () => {
  it('returns null when nothing is attached', () => {
    expect(resolveAttachedChoiceId(null, [toChoice(builtinItem())])).toBeNull();
  });

  it('matches by identity (policyName) even when the shape has drifted', () => {
    const choices = [toChoice(builtinItem())];
    // Attached carries the stamped identity but an OLDER shape (extra field the
    // current builtin no longer has) — identity match must still win.
    const attached = { defaultDailyLimits: { total: 3 }, legacyField: true, policyName: BUILTIN_NAME };
    expect(resolveAttachedChoiceId(attached, choices)).toBe(BUILTIN_ID);
  });

  it('falls back to structural match when no policyName is present', () => {
    const choices = [toChoice(builtinItem()), toChoice(userItem())];
    // Same shape as the builtin's policyData, minus identity (pre-stamping).
    const attached = { defaultDailyLimits: { total: 3, SINGLES: 2, DOUBLES: 2 } };
    expect(resolveAttachedChoiceId(attached, choices)).toBe(BUILTIN_ID);
  });

  it('returns null for a drifted custom policy that matches nothing (→ Attached entry)', () => {
    const choices = [toChoice(builtinItem())];
    const attached = { defaultDailyLimits: { total: 3 }, allowModificationWhenMatchUpsScheduled: { courts: false } };
    expect(resolveAttachedChoiceId(attached, choices)).toBeNull();
  });

  it('does not match by identity when the attached policyName is unknown', () => {
    const choices = [toChoice(builtinItem())];
    const attached = { defaultDailyLimits: { total: 999 }, policyName: 'Nonexistent' };
    expect(resolveAttachedChoiceId(attached, choices)).toBeNull();
  });
});

describe('buildAttachedChoice', () => {
  it('uses the matched catalog label when provided', () => {
    const choice = buildAttachedChoice({ policyName: BUILTIN_NAME }, BUILTIN_NAME);
    expect(choice.label).toBe(`Attached — ${BUILTIN_NAME}`);
    expect(choice.id).toBe(ATTACHED_POLICY_ID);
    expect(choice.source).toBe('attached');
  });

  it('falls back to the attached policyName when unmatched', () => {
    const choice = buildAttachedChoice({ policyName: 'Custom Name' }, null);
    expect(choice.label).toBe('Attached — Custom Name');
  });

  it('falls back to "Custom policy" when there is no name at all', () => {
    const choice = buildAttachedChoice({ defaultDailyLimits: { total: 3 } }, null);
    expect(choice.label).toBe('Attached — Custom policy');
  });

  it('wraps the raw attached policy as its definition', () => {
    const attached = { defaultDailyLimits: { total: 3 } };
    expect(buildAttachedChoice(attached, null).definition[POLICY_TYPE_SCHEDULING]).toBe(attached);
  });
});

describe('getAttachedSchedulingPolicy', () => {
  it('returns the policy from the engine', () => {
    findPolicyMock.mockReturnValue({ policy: { defaultDailyLimits: { total: 3 } } });
    expect(getAttachedSchedulingPolicy()).toEqual({ defaultDailyLimits: { total: 3 } });
    expect(findPolicyMock).toHaveBeenCalledWith({ policyType: POLICY_TYPE_SCHEDULING });
  });

  it('returns null when no policy is attached', () => {
    findPolicyMock.mockReturnValue({});
    expect(getAttachedSchedulingPolicy()).toBeNull();
  });

  it('returns null (never throws) when the engine call throws', () => {
    findPolicyMock.mockImplementation(() => {
      throw new Error('engine unavailable');
    });
    expect(getAttachedSchedulingPolicy()).toBeNull();
  });
});

describe('loadSchedulingChoices', () => {
  it('returns only scheduling policies from builtins + user policies, stamped', async () => {
    getBuiltinPoliciesMock.mockReturnValue([
      builtinItem(),
      { id: 'builtin-scoring', name: 'Scoring', policyType: 'scoring', source: 'builtin', description: '', policyData: {} },
    ]);
    loadUserPoliciesMock.mockResolvedValue([userItem()]);

    const choices = await loadSchedulingChoices();

    expect(choices.map((c) => c.id)).toEqual([BUILTIN_ID, 'user-1']);
    expect(choices[0].definition[POLICY_TYPE_SCHEDULING].policyName).toBe(BUILTIN_NAME);
    expect(choices[1].source).toBe('user');
  });

  it('degrades to builtins when loading user policies rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getBuiltinPoliciesMock.mockReturnValue([builtinItem()]);
    loadUserPoliciesMock.mockRejectedValue(new Error('idb blocked'));

    const choices = await loadSchedulingChoices();

    expect(choices.map((c) => c.id)).toEqual([BUILTIN_ID]);
    expect(consoleError).toHaveBeenCalled();
  });
});
