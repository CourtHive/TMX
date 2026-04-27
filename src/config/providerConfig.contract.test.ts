/**
 * Contract test — TMX `providerConfig` mirror must match the
 * canonical server type at
 * `competition-factory-server/src/modules/providers/provider-config.types.ts`.
 *
 * The two files are duplicates (Option A in the planning doc:
 * server-as-source + TMX mirror with contract test). When the
 * server canonical list changes, this test fails — which forces
 * the developer to update both sides consciously.
 *
 * The CANONICAL_* arrays below are the source of truth for what
 * the test enforces. They must be kept in lockstep with both the
 * server type module and the TMX `providerConfig.ts` module.
 *
 * When promoting types to a shared `@courthive/provider-config`
 * package (TASKS.md item — revisit when scaffolding more
 * capabilities), this test becomes redundant and can be deleted.
 */

import { describe, expect, it } from 'vitest';
import {
  ARRAY_PERMISSION_KEYS,
  BOOLEAN_PERMISSION_KEYS,
  PERMISSIONS_DEFAULT_FALSE,
} from './providerConfig';

const CANONICAL_BOOLEAN_PERMISSION_KEYS = [
  'canCreateCompetitors',
  'canCreateOfficials',
  'canDeleteParticipants',
  'canImportParticipants',
  'canEditParticipantDetails',
  'canCreateEvents',
  'canDeleteEvents',
  'canModifyEventFormat',
  'canCreateDraws',
  'canDeleteDraws',
  'canUseDraftPositioning',
  'canUseManualPositioning',
  'canModifySchedule',
  'canUseBulkScheduling',
  'canCreateVenues',
  'canDeleteVenues',
  'canModifyCourtAvailability',
  'canEnterScores',
  'canModifyCompletedScores',
  'canPublish',
  'canUnpublish',
  'canModifyTournamentDetails',
  'canModifyPolicies',
  'canAccessProviderAdmin',
] as const;

const CANONICAL_ARRAY_PERMISSION_KEYS = [
  'allowedDrawTypes',
  'allowedCreationMethods',
  'allowedScoringApproaches',
] as const;

const CANONICAL_PERMISSIONS_DEFAULT_FALSE = ['canModifyCompletedScores', 'canAccessProviderAdmin'] as const;

describe('providerConfig contract — TMX mirror matches server canonical type', () => {
  it('BOOLEAN_PERMISSION_KEYS matches canonical list (order-insensitive, set equality)', () => {
    const tmxSet = new Set(BOOLEAN_PERMISSION_KEYS);
    const canonicalSet = new Set(CANONICAL_BOOLEAN_PERMISSION_KEYS);
    expect(tmxSet.size).toBe(canonicalSet.size);
    for (const key of canonicalSet) expect(tmxSet.has(key)).toBe(true);
  });

  it('ARRAY_PERMISSION_KEYS matches canonical list (order-insensitive, set equality)', () => {
    const tmxSet = new Set(ARRAY_PERMISSION_KEYS);
    const canonicalSet = new Set(CANONICAL_ARRAY_PERMISSION_KEYS);
    expect(tmxSet.size).toBe(canonicalSet.size);
    for (const key of canonicalSet) expect(tmxSet.has(key)).toBe(true);
  });

  it('PERMISSIONS_DEFAULT_FALSE matches canonical set', () => {
    expect(PERMISSIONS_DEFAULT_FALSE.size).toBe(CANONICAL_PERMISSIONS_DEFAULT_FALSE.length);
    for (const key of CANONICAL_PERMISSIONS_DEFAULT_FALSE) {
      expect(PERMISSIONS_DEFAULT_FALSE.has(key)).toBe(true);
    }
  });

  it('boolean and array permission key sets are disjoint', () => {
    const boolSet = new Set(BOOLEAN_PERMISSION_KEYS);
    for (const arrKey of ARRAY_PERMISSION_KEYS) {
      expect(boolSet.has(arrKey as any)).toBe(false);
    }
  });

  it('every default-false key is in the boolean permission set', () => {
    const boolSet = new Set<string>(BOOLEAN_PERMISSION_KEYS);
    for (const key of PERMISSIONS_DEFAULT_FALSE) {
      expect(boolSet.has(key)).toBe(true);
    }
  });
});
