import { fixtures, policyConstants } from 'tods-competition-factory';
import type { PolicyCatalogItem } from 'courthive-components';
import { POLICY_SCHEDULING } from 'assets/policies/schedulingPolicy';
import { POLICY_SCORING } from 'assets/policies/scoringPolicy';
import { POLICY_SEEDING } from 'assets/policies/seedingPolicy';
import { tmx2db } from 'services/storage/tmx2db';

const { POLICY_TYPE_SCHEDULING, POLICY_TYPE_SCORING, POLICY_TYPE_SEEDING, POLICY_TYPE_RANKING_POINTS } =
  policyConstants;

const {
  policies: {
    POLICY_RANKING_POINTS_ATP,
    POLICY_RANKING_POINTS_BASIC,
    POLICY_RANKING_POINTS_WTA,
    POLICY_RANKING_POINTS_ITF_WTT,
    POLICY_RANKING_POINTS_ITF_JUNIOR,
    POLICY_RANKING_POINTS_TENNIS_EUROPE,
    POLICY_RANKING_POINTS_USTA_JUNIOR,
    POLICY_RANKING_POINTS_LTA,
    POLICY_RANKING_POINTS_TENNIS_AUSTRALIA,
    POLICY_RANKING_POINTS_TENNIS_CANADA,
  },
} = fixtures;

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
  {
    id: 'builtin-ranking-points-basic',
    name: 'Basic Ranking Points',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'Simple finishing-position points — works for any event regardless of category or level',
    policyData: POLICY_RANKING_POINTS_BASIC[POLICY_TYPE_RANKING_POINTS],
  },
  {
    id: 'builtin-ranking-points-atp',
    name: 'ATP Ranking Points (2026)',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'PIF ATP Rankings — Grand Slams through ITF events, 15 tournament levels',
    policyData: POLICY_RANKING_POINTS_ATP[POLICY_TYPE_RANKING_POINTS],
  },
  {
    id: 'builtin-ranking-points-wta',
    name: 'WTA Ranking Points (2026)',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'PIF WTA Rankings — Grand Slams through WTA 125, with quality win bonuses',
    policyData: POLICY_RANKING_POINTS_WTA[POLICY_TYPE_RANKING_POINTS],
  },
  {
    id: 'builtin-ranking-points-itf-wtt',
    name: 'ITF World Tennis Tour Points',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'ITF World Tennis Tour — qualifying round points for $15K–$25K+H tournaments',
    policyData: POLICY_RANKING_POINTS_ITF_WTT[POLICY_TYPE_RANKING_POINTS],
  },
  {
    id: 'builtin-ranking-points-usta-junior',
    name: 'USTA Junior Ranking Points',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'USTA Junior Rankings — 7 levels, 8 age categories, quality win bonuses, multiple draw formats',
    policyData: POLICY_RANKING_POINTS_USTA_JUNIOR[POLICY_TYPE_RANKING_POINTS],
  },
  {
    id: 'builtin-ranking-points-itf-junior',
    name: 'ITF Junior Circuit Points',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'ITF Junior Circuit — Grand Slams through J30, 9 levels with qualifying and consolation',
    policyData: POLICY_RANKING_POINTS_ITF_JUNIOR[POLICY_TYPE_RANKING_POINTS],
  },
  {
    id: 'builtin-ranking-points-tennis-europe',
    name: 'Tennis Europe Junior Tour Points',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'Tennis Europe Junior Tour — 6 levels from TE Super to TE 12 Cat 2, with bonus draws',
    policyData: POLICY_RANKING_POINTS_TENNIS_EUROPE[POLICY_TYPE_RANKING_POINTS],
  },
  {
    id: 'builtin-ranking-points-lta',
    name: 'LTA Ranking Points',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'LTA Rankings — Premier through Grade 5, consolation/qualifying/team events, doubles at 25%',
    policyData: POLICY_RANKING_POINTS_LTA[POLICY_TYPE_RANKING_POINTS],
  },
  {
    id: 'builtin-ranking-points-tennis-australia',
    name: 'Tennis Australia Junior Tour Points',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'Tennis Australia De Minaur Junior Tour — J1000/J500/J250/J125, best 8 results',
    policyData: POLICY_RANKING_POINTS_TENNIS_AUSTRALIA[POLICY_TYPE_RANKING_POINTS],
  },
  {
    id: 'builtin-ranking-points-tennis-canada',
    name: 'Tennis Canada Junior Ranking Points',
    policyType: POLICY_TYPE_RANKING_POINTS,
    source: 'builtin',
    description: 'Tennis Canada Junior Rankings — 5 levels, U12-U18, requires match win for points',
    policyData: POLICY_RANKING_POINTS_TENNIS_CANADA[POLICY_TYPE_RANKING_POINTS],
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
