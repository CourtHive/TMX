import { policies as cataloguePolicies } from '@courthive/competition-catalogue';
import { fixtures, policyConstants } from 'tods-competition-factory';
import { describe, expect, it, vi } from 'vitest';

// the built-in list never touches IndexedDB; stub the store so importing the bridge opens nothing
vi.mock('services/storage/tmx2db', () => ({ tmx2db: {} }));

import { getAvailablePolicies } from 'components/tables/pointsTable/policyUtils';
import { getBuiltinPolicies } from 'pages/policies/policyBridge';

const { POLICY_TYPE_RANKING_POINTS } = policyConstants;

const RANKING_PRESETS = [
  ['builtin-ranking-points-basic', 'POLICY_RANKING_POINTS_BASIC'],
  ['builtin-ranking-points-atp', 'TEMPLATE_RANKING_POINTS_ATP'],
  ['builtin-ranking-points-wta', 'TEMPLATE_RANKING_POINTS_WTA'],
  ['builtin-ranking-points-itf-wtt', 'TEMPLATE_RANKING_POINTS_ITF_WTT'],
  ['builtin-ranking-points-itf-junior', 'TEMPLATE_RANKING_POINTS_ITF_JUNIOR'],
] as const;

/**
 * The ranking-points presets are read from the factory's `fixtures.policies` (its provider-neutral BASIC preset) and
 * from the competition catalogue (the organisation presets). A read from the wrong object yields `undefined`
 * policyData silently, and the catalogue offers an entry that holds nothing; these tests fail first if either source
 * stops shipping one.
 */
const presetSources = { ...fixtures.policies, ...cataloguePolicies };
describe('policyBridge built-in ranking presets', () => {
  it('finds every ranking-points preset it lists', () => {
    const builtins = getBuiltinPolicies();

    for (const [id, key] of RANKING_PRESETS) {
      const item = builtins.find((builtin) => builtin.id === id);
      expect(item, id).toBeDefined();
      expect(item?.policyType).toEqual(POLICY_TYPE_RANKING_POINTS);
      expect(item?.policyData, id).toBeDefined();
      expect(item?.policyData).toBe((presetSources as any)[key][POLICY_TYPE_RANKING_POINTS]);
      const { awardProfiles } = (item?.policyData ?? {}) as { awardProfiles?: unknown[] };
      expect(awardProfiles?.length, id).toBeGreaterThan(0);
    }
  });

  it('carries policyData for every built-in', () => {
    for (const item of getBuiltinPolicies()) expect(item.policyData, item.id).toBeDefined();
  });

  it('offers the same presets as points-table options', () => {
    const optionIds = getAvailablePolicies().map(({ id }) => id);

    for (const [, key] of RANKING_PRESETS) expect(optionIds).toContain(key);
  });
});
