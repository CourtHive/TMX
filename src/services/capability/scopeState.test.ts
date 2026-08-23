import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearCallerGrants, isPermittedOnResource, isScopeUnrestricted, setCallerGrants } from './scopeState';
import { isTargetInScope } from '@courthive/provider-config';
import { canForResource, cannotForResource, can } from './can';
import { providerConfig } from 'config/providerConfig';

const COURT_7 = { capability: 'canEnterScores', scope: { courtIds: ['court-7'] } };

describe('scope state', () => {
  beforeEach(() => {
    providerConfig.reset();
    clearCallerGrants();
  });
  afterEach(() => clearCallerGrants());

  it('is unrestricted with no grants — not restricted to nothing', () => {
    expect(isScopeUnrestricted()).toBe(true);
    expect(isPermittedOnResource('canEnterScores', { courtId: 'centre' })).toBe(true);
  });

  describe('isTargetInScope — now the shared predicate, no longer mirrored', () => {
    it('treats an empty scope as tournament-wide', () => {
      expect(isTargetInScope({}, { courtId: 'centre' })).toBe(true);
      expect(isTargetInScope(undefined, {})).toBe(true);
    });

    it('matches a declared dimension', () => {
      expect(isTargetInScope({ courtIds: ['c1'] }, { courtId: 'c1' })).toBe(true);
      expect(isTargetInScope({ courtIds: ['c1'] }, { courtId: 'c2' })).toBe(false);
    });

    it('denies a resource that cannot answer the dimension', () => {
      expect(isTargetInScope({ courtIds: ['c1'] }, {})).toBe(false);
    });

    it('requires every declared dimension', () => {
      const scope = { courtIds: ['c1'], scheduledDates: ['2026-08-24'] };
      expect(isTargetInScope(scope, { courtId: 'c1', scheduledDate: '2026-08-24' })).toBe(true);
      expect(isTargetInScope(scope, { courtId: 'c1', scheduledDate: '2026-08-25' })).toBe(false);
    });

    it('refuses a scope with an unrecognized key rather than ignoring it', () => {
      expect(isTargetInScope({ somethingNew: ['x'] } as any, { courtId: 'c1' })).toBe(false);
    });
  });

  describe('capability bounds the grant', () => {
    it('does not let a scoring grant authorize scheduling', () => {
      setCallerGrants([COURT_7]);
      expect(isPermittedOnResource('canEnterScores', { courtId: 'court-7' })).toBe(true);
      expect(isPermittedOnResource('canModifySchedule', { courtId: 'court-7' })).toBe(false);
    });

    it('honors the wildcard', () => {
      setCallerGrants([{ capability: '*', scope: { courtIds: ['court-7'] } }]);
      expect(isPermittedOnResource('canModifySchedule', { courtId: 'court-7' })).toBe(true);
      expect(isPermittedOnResource('canModifySchedule', { courtId: 'centre' })).toBe(false);
    });
  });
});

describe('canForResource', () => {
  beforeEach(() => {
    providerConfig.reset();
    clearCallerGrants();
  });
  afterEach(() => clearCallerGrants());

  // The distinction a global boolean cannot make.
  it('permits scoring on the granted court and refuses the final on Centre', () => {
    setCallerGrants([COURT_7]);
    expect(canForResource('enterScores', { courtId: 'court-7' }).allowed).toBe(true);

    const denied = canForResource('enterScores', { courtId: 'centre' });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.because).toBe('scope');
      expect(denied.reason.length).toBeGreaterThan(0);
    }
  });

  // The most specific true reason wins: a provider that forbids scoring
  // outright is a better explanation than "not on your court".
  it('reports the provider layer when the capability does not exist at all', () => {
    providerConfig.set({ permissions: { canEnterScores: false } });
    setCallerGrants([COURT_7]);
    const denied = canForResource('enterScores', { courtId: 'court-7' });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.because).toBe('provider');
  });

  it('is a no-op when the subject holds no grants', () => {
    expect(canForResource('enterScores', { courtId: 'centre' })).toEqual({ allowed: true });
    expect(can('enterScores')).toEqual({ allowed: true });
  });

  it('cannotForResource is the negation, for hide/disabled call sites', () => {
    setCallerGrants([COURT_7]);
    expect(cannotForResource('enterScores', { courtId: 'centre' })).toBe(true);
    expect(cannotForResource('enterScores', { courtId: 'court-7' })).toBe(false);
  });

  it('re-evaluates when grants change rather than caching the decision', () => {
    setCallerGrants([COURT_7]);
    expect(cannotForResource('enterScores', { courtId: 'centre' })).toBe(true);
    clearCallerGrants();
    expect(cannotForResource('enterScores', { courtId: 'centre' })).toBe(false);
  });
});
