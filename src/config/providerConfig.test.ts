import { describe, expect, it, beforeEach } from 'vitest';
import { providerConfig } from './providerConfig';

const BEST_OF_3 = 'SET3-S:6/TB7';

describe('providerConfig', () => {
  beforeEach(() => {
    providerConfig.reset();
  });

  describe('get / set / reset', () => {
    it('returns empty config by default', () => {
      expect(providerConfig.get()).toEqual({});
    });

    it('merges partial config on set', () => {
      providerConfig.set({ branding: { appName: 'TestApp' } });
      expect(providerConfig.get().branding?.appName).toBe('TestApp');
    });

    it('merges multiple set calls', () => {
      providerConfig.set({ branding: { appName: 'A' } });
      providerConfig.set({ permissions: { canCreateEvents: false } });
      expect(providerConfig.get().branding?.appName).toBe('A');
      expect(providerConfig.get().permissions?.canCreateEvents).toBe(false);
    });

    it('resets to empty', () => {
      providerConfig.set({ branding: { appName: 'X' } });
      providerConfig.reset();
      expect(providerConfig.get()).toEqual({});
    });
  });

  describe('isAllowed', () => {
    it('returns true for all boolean permissions by default', () => {
      expect(providerConfig.isAllowed('canCreateCompetitors')).toBe(true);
      expect(providerConfig.isAllowed('canCreateEvents')).toBe(true);
      expect(providerConfig.isAllowed('canDeleteEvents')).toBe(true);
      expect(providerConfig.isAllowed('canCreateDraws')).toBe(true);
      expect(providerConfig.isAllowed('canModifySchedule')).toBe(true);
      expect(providerConfig.isAllowed('canEnterScores')).toBe(true);
      expect(providerConfig.isAllowed('canPublish')).toBe(true);
    });

    it('returns false for canModifyCompletedScores by default', () => {
      expect(providerConfig.isAllowed('canModifyCompletedScores')).toBe(false);
    });

    it('returns false for canAccessProviderAdmin by default', () => {
      expect(providerConfig.isAllowed('canAccessProviderAdmin')).toBe(false);
    });

    it('respects explicitly set false permissions', () => {
      providerConfig.set({ permissions: { canCreateCompetitors: false } });
      expect(providerConfig.isAllowed('canCreateCompetitors')).toBe(false);
    });

    it('respects explicitly set true permissions', () => {
      providerConfig.set({ permissions: { canModifyCompletedScores: true } });
      expect(providerConfig.isAllowed('canModifyCompletedScores')).toBe(true);
    });

    it('returns default for permissions not set in partial config', () => {
      providerConfig.set({ permissions: { canCreateEvents: false } });
      // canCreateCompetitors was not set, should still default to true
      expect(providerConfig.isAllowed('canCreateCompetitors')).toBe(true);
      expect(providerConfig.isAllowed('canCreateEvents')).toBe(false);
    });
  });

  describe('getAllowedList', () => {
    it('returns empty array for unrestricted draw types', () => {
      expect(providerConfig.getAllowedList('allowedDrawTypes')).toEqual([]);
    });

    it('returns empty array for unrestricted creation methods', () => {
      expect(providerConfig.getAllowedList('allowedCreationMethods')).toEqual([]);
    });

    it('returns configured draw types when set', () => {
      providerConfig.set({
        permissions: { allowedDrawTypes: ['SINGLE_ELIMINATION', 'ROUND_ROBIN'] },
      });
      expect(providerConfig.getAllowedList('allowedDrawTypes')).toEqual([
        'SINGLE_ELIMINATION',
        'ROUND_ROBIN',
      ]);
    });

    it('returns configured creation methods when set', () => {
      providerConfig.set({
        permissions: { allowedCreationMethods: ['AUTOMATED'] },
      });
      expect(providerConfig.getAllowedList('allowedCreationMethods')).toEqual(['AUTOMATED']);
    });

    it('returns allowed matchUp formats from policies', () => {
      providerConfig.set({
        policies: { allowedMatchUpFormats: [BEST_OF_3, 'SET1-S:6/TB7'] },
      });
      expect(providerConfig.getAllowedList('allowedMatchUpFormats')).toEqual([
        BEST_OF_3,
        'SET1-S:6/TB7',
      ]);
    });

    it('returns allowed categories from policies', () => {
      providerConfig.set({
        policies: {
          allowedCategories: [
            { ageCategoryCode: 'U14', categoryName: 'Under 14' },
            { ageCategoryCode: 'U18' },
          ],
        },
      });
      const cats = providerConfig.getAllowedList('allowedCategories');
      expect(cats).toHaveLength(2);
      expect(cats[0].ageCategoryCode).toBe('U14');
    });

    it('returns empty after reset', () => {
      providerConfig.set({
        permissions: { allowedDrawTypes: ['SINGLE_ELIMINATION'] },
      });
      providerConfig.reset();
      expect(providerConfig.getAllowedList('allowedDrawTypes')).toEqual([]);
    });
  });

  describe('venue permissions', () => {
    it('allows venue creation by default', () => {
      expect(providerConfig.isAllowed('canCreateVenues')).toBe(true);
    });

    it('allows venue deletion by default', () => {
      expect(providerConfig.isAllowed('canDeleteVenues')).toBe(true);
    });

    it('respects disabled venue creation', () => {
      providerConfig.set({ permissions: { canCreateVenues: false } });
      expect(providerConfig.isAllowed('canCreateVenues')).toBe(false);
    });

    it('respects disabled venue deletion', () => {
      providerConfig.set({ permissions: { canDeleteVenues: false } });
      expect(providerConfig.isAllowed('canDeleteVenues')).toBe(false);
    });

    it('allows court availability modification by default', () => {
      expect(providerConfig.isAllowed('canModifyCourtAvailability')).toBe(true);
    });
  });

  describe('draw permissions', () => {
    it('allows draw creation by default', () => {
      expect(providerConfig.isAllowed('canCreateDraws')).toBe(true);
    });

    it('allows draw deletion by default', () => {
      expect(providerConfig.isAllowed('canDeleteDraws')).toBe(true);
    });

    it('respects disabled draw creation', () => {
      providerConfig.set({ permissions: { canCreateDraws: false } });
      expect(providerConfig.isAllowed('canCreateDraws')).toBe(false);
    });

    it('respects disabled draw deletion', () => {
      providerConfig.set({ permissions: { canDeleteDraws: false } });
      expect(providerConfig.isAllowed('canDeleteDraws')).toBe(false);
    });
  });

  describe('scoring permissions', () => {
    it('allows entering scores by default', () => {
      expect(providerConfig.isAllowed('canEnterScores')).toBe(true);
    });

    it('disallows modifying completed scores by default', () => {
      expect(providerConfig.isAllowed('canModifyCompletedScores')).toBe(false);
    });

    it('returns empty scoring approaches by default', () => {
      expect(providerConfig.getAllowedList('allowedScoringApproaches')).toEqual([]);
    });

    it('returns configured scoring approaches', () => {
      providerConfig.set({ permissions: { allowedScoringApproaches: ['dynamicSets'] } });
      expect(providerConfig.getAllowedList('allowedScoringApproaches')).toEqual(['dynamicSets']);
    });
  });

  describe('publishing permissions', () => {
    it('allows publishing by default', () => {
      expect(providerConfig.isAllowed('canPublish')).toBe(true);
    });

    it('allows unpublishing by default', () => {
      expect(providerConfig.isAllowed('canUnpublish')).toBe(true);
    });

    it('respects disabled publishing', () => {
      providerConfig.set({ permissions: { canPublish: false, canUnpublish: false } });
      expect(providerConfig.isAllowed('canPublish')).toBe(false);
      expect(providerConfig.isAllowed('canUnpublish')).toBe(false);
    });
  });

  describe('settings permissions', () => {
    it('allows modifying tournament details by default', () => {
      expect(providerConfig.isAllowed('canModifyTournamentDetails')).toBe(true);
    });

    it('allows modifying policies by default', () => {
      expect(providerConfig.isAllowed('canModifyPolicies')).toBe(true);
    });

    it('disallows provider admin access by default', () => {
      expect(providerConfig.isAllowed('canAccessProviderAdmin')).toBe(false);
    });
  });

  describe('defaults', () => {
    it('returns undefined defaults when not set', () => {
      expect(providerConfig.get().defaults).toBeUndefined();
    });

    it('stores and retrieves defaults', () => {
      providerConfig.set({
        defaults: {
          defaultEventType: 'SINGLES',
          defaultDrawType: 'SINGLE_ELIMINATION',
          defaultGender: 'MALE',
        },
      });
      const defaults = providerConfig.get().defaults;
      expect(defaults?.defaultEventType).toBe('SINGLES');
      expect(defaults?.defaultDrawType).toBe('SINGLE_ELIMINATION');
      expect(defaults?.defaultGender).toBe('MALE');
    });
  });

  describe('combined provider scenario', () => {
    it('simulates a restrictive provider configuration', () => {
      providerConfig.set({
        branding: {
          appName: 'USTA Central',
          navbarLogoUrl: 'https://example.com/logo.png',
          accentColor: '#1a5276',
        },
        permissions: {
          canCreateCompetitors: false,
          canDeleteParticipants: false,
          canImportParticipants: false,
          canCreateEvents: false,
          canDeleteEvents: false,
          canUseDraftPositioning: false,
          canCreateVenues: false,
          canDeleteVenues: false,
          allowedDrawTypes: ['SINGLE_ELIMINATION', 'ROUND_ROBIN'],
          canUseBulkScheduling: false,
        },
        policies: {
          allowedMatchUpFormats: [BEST_OF_3],
          allowedCategories: [{ ageCategoryCode: 'U14' }, { ageCategoryCode: 'U18' }],
        },
      });

      // Branding
      expect(providerConfig.get().branding?.appName).toBe('USTA Central');
      expect(providerConfig.get().branding?.navbarLogoUrl).toBe('https://example.com/logo.png');

      // Blocked actions
      expect(providerConfig.isAllowed('canCreateCompetitors')).toBe(false);
      expect(providerConfig.isAllowed('canDeleteParticipants')).toBe(false);
      expect(providerConfig.isAllowed('canImportParticipants')).toBe(false);
      expect(providerConfig.isAllowed('canCreateEvents')).toBe(false);
      expect(providerConfig.isAllowed('canDeleteEvents')).toBe(false);
      expect(providerConfig.isAllowed('canUseDraftPositioning')).toBe(false);
      expect(providerConfig.isAllowed('canUseBulkScheduling')).toBe(false);
      expect(providerConfig.isAllowed('canCreateVenues')).toBe(false);
      expect(providerConfig.isAllowed('canDeleteVenues')).toBe(false);

      // Allowed actions (not restricted)
      expect(providerConfig.isAllowed('canCreateDraws')).toBe(true);
      expect(providerConfig.isAllowed('canEnterScores')).toBe(true);
      expect(providerConfig.isAllowed('canModifySchedule')).toBe(true);
      expect(providerConfig.isAllowed('canPublish')).toBe(true);

      // Restricted lists
      expect(providerConfig.getAllowedList('allowedDrawTypes')).toEqual([
        'SINGLE_ELIMINATION',
        'ROUND_ROBIN',
      ]);
      expect(providerConfig.getAllowedList('allowedMatchUpFormats')).toEqual([BEST_OF_3]);
      expect(providerConfig.getAllowedList('allowedCategories')).toHaveLength(2);
    });
  });
});
