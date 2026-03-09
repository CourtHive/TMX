/**
 * Utilities for ranking policy introspection — detect level requirements,
 * extract available levels, and build policy option lists.
 */
import { fixtures } from 'tods-competition-factory';

const { policies: factoryPolicies } = fixtures;

export type PolicyOption = {
  id: string;
  label: string;
  policyData: any;
  requiresLevel: boolean;
  availableLevels: number[];
  levelLabels: Record<number, string>;
};

const POLICY_KEYS = [
  ['POLICY_RANKING_POINTS_BASIC', 'Basic Ranking Points'],
  ['POLICY_RANKING_POINTS_ATP', 'ATP Rankings'],
  ['POLICY_RANKING_POINTS_WTA', 'WTA Rankings'],
  ['POLICY_RANKING_POINTS_ITF_WTT', 'ITF World Tennis Tour'],
  ['POLICY_RANKING_POINTS_ITF_JUNIOR', 'ITF Junior Circuit'],
  ['POLICY_RANKING_POINTS_TENNIS_EUROPE', 'Tennis Europe Junior Tour'],
  ['POLICY_RANKING_POINTS_USTA_JUNIOR', 'USTA Junior Rankings'],
  ['POLICY_RANKING_POINTS_LTA', 'LTA Rankings'],
  ['POLICY_RANKING_POINTS_TENNIS_AUSTRALIA', 'Tennis Australia Junior Tour'],
  ['POLICY_RANKING_POINTS_TENNIS_CANADA', 'Tennis Canada Junior Rankings'],
] as const;

/**
 * Extract the set of levels used across all award profiles in a policy.
 * A policy "requires level" if any profile specifies `levels`, `maxLevel`,
 * or uses level-keyed values (e.g. `{ level: { 1: 100, 2: 80 } }`).
 * Some profiles (like United Cup) are universal and don't specify levels —
 * this doesn't disqualify the policy from being level-aware.
 */
function analyzePolicyLevels(policyData: any): { requiresLevel: boolean; availableLevels: number[] } {
  const policyKey = Object.keys(policyData)[0];
  const policy = policyData[policyKey];
  const profiles = policy?.awardProfiles || [];
  if (!profiles.length) return { requiresLevel: false, availableLevels: [] };

  const allLevels = new Set<number>();

  for (const profile of profiles) {
    if (profile.levels?.length) {
      for (const l of profile.levels) allLevels.add(l);
    } else if (profile.maxLevel) {
      for (let l = 1; l <= profile.maxLevel; l++) allLevels.add(l);
    } else {
      // Check for level-keyed values inside the profile as a secondary signal
      const inlineLevels = extractInlineLevels(profile);
      for (const l of inlineLevels) allLevels.add(l);
    }
  }

  return {
    requiresLevel: allLevels.size > 0,
    availableLevels: Array.from(allLevels).sort((a, b) => a - b),
  };
}

/** Scan a profile for `{ level: { <number>: ... } }` patterns in point values. */
function extractInlineLevels(profile: any): number[] {
  const levels = new Set<number>();
  const scan = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.level && typeof obj.level === 'object') {
      for (const key of Object.keys(obj.level)) {
        const n = Number(key);
        if (!Number.isNaN(n)) levels.add(n);
      }
      return;
    }
    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object') scan(val);
    }
  };
  scan(profile.finishingPositionRanges);
  scan(profile.perWinPoints);
  scan(profile.bonusPoints);
  return Array.from(levels);
}

/**
 * Parse level labels from the policy file's header comment block.
 * Policies like ATP include comments like "Level 1: Grand Slams (2000 pts)".
 * Since we can't read comments at runtime, we use the profile names instead.
 */
function extractLevelLabels(policyData: any): Record<number, string> {
  const policyKey = Object.keys(policyData)[0];
  const policy = policyData[policyKey];
  const profiles = policy?.awardProfiles || [];
  const labels: Record<number, string> = {};

  for (const profile of profiles) {
    if (profile.levels?.length === 1) {
      const level = profile.levels[0];
      if (!labels[level]) labels[level] = profile.profileName || `Level ${level}`;
    }
  }

  return labels;
}

export function getAvailablePolicies(): PolicyOption[] {
  const options: PolicyOption[] = [];

  for (const [key, fallbackLabel] of POLICY_KEYS) {
    const data = (factoryPolicies as any)[key];
    if (!data) continue;
    const policy = data[Object.keys(data)[0]];
    const { requiresLevel, availableLevels } = analyzePolicyLevels(data);
    const levelLabels = requiresLevel ? extractLevelLabels(data) : {};

    options.push({
      id: key,
      label: policy?.policyName || fallbackLabel,
      policyData: data,
      requiresLevel,
      availableLevels,
      levelLabels,
    });
  }

  return options;
}

/**
 * Build display label for a level option.
 * Uses profileName from single-level profiles when available.
 */
export function getLevelDisplayLabel(level: number, policy: PolicyOption): string {
  const profileLabel = policy.levelLabels[level];
  if (profileLabel) return `L${level}: ${profileLabel}`;
  return `Level ${level}`;
}
