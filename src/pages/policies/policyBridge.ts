import { policyConstants } from 'tods-competition-factory';
import type { PolicyCatalogItem } from 'courthive-components';
import { POLICY_SCHEDULING } from 'assets/policies/schedulingPolicy';
import { POLICY_SCORING } from 'assets/policies/scoringPolicy';
import { POLICY_SEEDING } from 'assets/policies/seedingPolicy';
import { tmx2db } from 'services/storage/tmx2db';

const { POLICY_TYPE_SCHEDULING, POLICY_TYPE_SCORING, POLICY_TYPE_SEEDING } = policyConstants;

const BUILTIN_POLICIES: PolicyCatalogItem[] = [
  {
    id: 'builtin-scheduling',
    name: 'Default Scheduling',
    policyType: POLICY_TYPE_SCHEDULING,
    source: 'builtin',
    description: 'Default match scheduling times, recovery periods, and daily limits',
    policyData: POLICY_SCHEDULING[POLICY_TYPE_SCHEDULING],
  },
  {
    id: 'builtin-scoring',
    name: 'Default Scoring',
    policyType: POLICY_TYPE_SCORING,
    source: 'builtin',
    description: 'Default scoring formats and match completion rules',
    policyData: POLICY_SCORING[POLICY_TYPE_SCORING],
  },
  {
    id: 'builtin-seeding',
    name: 'Default Seeding',
    policyType: POLICY_TYPE_SEEDING,
    source: 'builtin',
    description: 'Default seeding thresholds and positioning rules',
    policyData: POLICY_SEEDING[POLICY_TYPE_SEEDING],
  },
];

export function getBuiltinPolicies(): PolicyCatalogItem[] {
  return BUILTIN_POLICIES;
}

export async function loadUserPolicies(): Promise<PolicyCatalogItem[]> {
  return tmx2db.findAll('policies');
}

export async function saveUserPolicy(item: PolicyCatalogItem): Promise<void> {
  await tmx2db.modifyOrAddUnique('policies', 'id', item.id, item);
}

export async function deleteUserPolicy(id: string): Promise<void> {
  await (tmx2db.dex as any).policies.where('id').equals(id).delete();
}
