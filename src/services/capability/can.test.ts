import { beforeEach, describe, expect, it } from 'vitest';

import { can, cannot, denialReason, permissionForAction } from './can';
import type { CapabilityAction } from './can';
import { providerConfig } from 'config/providerConfig';

const ALL_ACTIONS: CapabilityAction[] = [
  'createCompetitor',
  'createOfficial',
  'importParticipants',
  'deleteParticipants',
  'editParticipantDetails',
  'modifyEntries',
  'createEvent',
  'deleteEvent',
  'createDraw',
  'deleteDraw',
  'assignPositions',
  'modifyStructures',
  'createVenue',
  'deleteVenue',
  'modifySchedule',
  'useBulkScheduling',
  'enterScores',
  'publish',
  'unpublish',
  'useChat',
];

describe('can()', () => {
  beforeEach(() => providerConfig.reset());

  it('allows every action for an unconfigured provider', () => {
    // The production reality: 0 of 1130 providers configure permissions, so an
    // unconfigured provider must retain full capability.
    for (const action of ALL_ACTIONS) {
      expect(can(action), action).toEqual({ allowed: true });
    }
  });

  it('denies when the provider turns the permission off, and says which layer refused', () => {
    providerConfig.set({ permissions: { canCreateEvents: false } });
    const result = can('createEvent');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.because).toBe('provider');
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('carries a distinct, non-key reason per action rather than echoing the flag name', () => {
    providerConfig.set({ permissions: { canCreateEvents: false, canCreateDraws: false } });
    const event = denialReason('createEvent');
    const draw = denialReason('createDraw');
    expect(event).not.toEqual(draw);
    // A reason that just names the permission key teaches nothing.
    expect(event).not.toContain('canCreateEvents');
  });

  it('closes the Staff/Officials drift — the two map to different keys', () => {
    // TMX gated the Officials view on canCreateOfficials while the server
    // enforced canCreateCompetitors for both, so the button appeared and the
    // save failed. Both are now explicit and separately answerable.
    expect(permissionForAction('createOfficial')).toBe('canCreateOfficials');
    expect(permissionForAction('createCompetitor')).toBe('canCreateCompetitors');

    providerConfig.set({ permissions: { canCreateOfficials: false } });
    expect(can('createOfficial').allowed).toBe(false);
    expect(can('createCompetitor').allowed).toBe(true);
  });

  it('every action maps to a permission key', () => {
    for (const action of ALL_ACTIONS) expect(permissionForAction(action)).toMatch(/^can[A-Z]/);
  });

  it('cannot() is the negation, for `hide:` call sites', () => {
    providerConfig.set({ permissions: { canDeleteVenues: false } });
    expect(cannot('deleteVenue')).toBe(true);
    expect(cannot('createVenue')).toBe(false);
  });

  it('denialReason is undefined when allowed', () => {
    expect(denialReason('createEvent')).toBeUndefined();
  });

  it('re-evaluates against current config rather than caching', () => {
    expect(can('publish').allowed).toBe(true);
    providerConfig.set({ permissions: { canPublish: false } });
    expect(can('publish').allowed).toBe(false);
    providerConfig.reset();
    expect(can('publish').allowed).toBe(true);
  });
});
