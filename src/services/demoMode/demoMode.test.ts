import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearDemoOverlay, getDemoOverlay, isDemoActive, setDemoOverlay, setDemoPermission } from './demoState';
import { intersectList, intersectPermissions } from './intersect';
import { overridesForPreset } from './demoPresets';
import { providerConfig } from 'config/providerConfig';
import { can } from 'services/capability/can';

describe('demo overlay — intersect only', () => {
  it('can remove a capability', () => {
    expect(intersectPermissions({ canCreateEvents: true }, { canCreateEvents: false }).canCreateEvents).toBe(false);
  });

  it('cannot grant one the provider has denied', () => {
    // The overlay type makes `true` unrepresentable; this asserts the runtime
    // agrees even if someone casts around the type.
    const result = intersectPermissions({ canCreateEvents: false }, { canCreateEvents: true } as any);
    expect(result.canCreateEvents).toBe(false);
  });

  it('leaves untouched keys alone', () => {
    const result = intersectPermissions({ canPublish: true, canCreateDraws: true }, { canPublish: false });
    expect(result.canCreateDraws).toBe(true);
  });
});

describe('intersectList — empty base means unrestricted (A3)', () => {
  it('treats an empty base as "no restriction yet" rather than "nothing allowed"', () => {
    // The fail-open trap: naive intersection would return [] here, which
    // getAllowedList consumers read as UNRESTRICTED — more permissive, not less.
    expect(intersectList([], ['SINGLE_ELIMINATION'])).toEqual(['SINGLE_ELIMINATION']);
    expect(intersectList(undefined, ['SINGLE_ELIMINATION'])).toEqual(['SINGLE_ELIMINATION']);
  });

  it('intersects when the base is a real restriction', () => {
    expect(intersectList(['A', 'B', 'C'], ['B', 'C', 'D'])).toEqual(['B', 'C']);
  });

  it('is a no-op without an overlay', () => {
    expect(intersectList(['A'], undefined)).toEqual(['A']);
  });
});

describe('demo overlay reaches the production resolution path', () => {
  beforeEach(() => {
    providerConfig.reset();
    clearDemoOverlay();
  });
  afterEach(() => clearDemoOverlay());

  it('is invisible when inactive', () => {
    expect(isDemoActive()).toBe(false);
    expect(can('createEvent').allowed).toBe(true);
  });

  // The point of injecting at providerConfig's accessors: every existing and
  // future call site picks the overlay up with no per-site change, and there is
  // no parallel demo path to diverge (standard A1).
  it('is observed by providerConfig.isAllowed', () => {
    setDemoPermission('canCreateEvents', false);
    expect(providerConfig.isAllowed('canCreateEvents')).toBe(false);
  });

  it('is observed by the can() resolver, with a reason', () => {
    setDemoPermission('canCreateEvents', false);
    const result = can('createEvent');
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.because).toBe('provider');
  });

  it('is observed by providerConfig.get()', () => {
    setDemoPermission('canPublish', false);
    expect(providerConfig.get().permissions?.canPublish).toBe(false);
  });

  it('survives providerConfig.reset() — a provider switch must not drop the posture', () => {
    setDemoPermission('canCreateEvents', false);
    providerConfig.reset();
    expect(providerConfig.isAllowed('canCreateEvents')).toBe(false);
  });

  it('still intersects after a later provider config is applied', () => {
    setDemoPermission('canCreateEvents', false);
    providerConfig.set({ permissions: { canCreateEvents: true } });
    expect(providerConfig.isAllowed('canCreateEvents')).toBe(false);
  });

  it('is fully reversible', () => {
    setDemoPermission('canCreateEvents', false);
    expect(can('createEvent').allowed).toBe(false);
    clearDemoOverlay();
    expect(can('createEvent').allowed).toBe(true);
  });

  it('memoization invalidates on both config and demo changes', () => {
    expect(providerConfig.isAllowed('canPublish')).toBe(true);
    setDemoPermission('canPublish', false);
    expect(providerConfig.isAllowed('canPublish')).toBe(false);
    setDemoPermission('canPublish', true);
    expect(providerConfig.isAllowed('canPublish')).toBe(true);
  });
});

describe('presets set the checkboxes rather than bypassing them', () => {
  beforeEach(() => clearDemoOverlay());
  afterEach(() => clearDemoOverlay());

  it('providerDefaults removes the overlay rather than switching everything on', () => {
    expect(overridesForPreset('providerDefaults')).toBeUndefined();
  });

  it('recorder allows scoring and denies everything structural', () => {
    const overrides = overridesForPreset('recorder')!;
    expect(overrides.canEnterScores).toBeUndefined(); // left on
    expect(overrides.canCreateEvents).toBe(false);
    expect(overrides.canCreateDraws).toBe(false);
    expect(overrides.canAssignPositions).toBe(false);
    expect(overrides.canCreateVenues).toBe(false);
    expect(overrides.canModifySchedule).toBe(false);
  });

  it('a recorder posture is observable through the resolver', () => {
    setDemoOverlay({ v: 1, preset: 'recorder', permissions: overridesForPreset('recorder')! });
    expect(can('enterScores').allowed).toBe(true);
    expect(can('createEvent').allowed).toBe(false);
    expect(can('createDraw').allowed).toBe(false);
    expect(can('modifySchedule').allowed).toBe(false);
  });

  it('scheduler adds scheduling to the recorder posture', () => {
    setDemoOverlay({ v: 1, preset: 'scheduler', permissions: overridesForPreset('scheduler')! });
    expect(can('modifySchedule').allowed).toBe(true);
    expect(can('enterScores').allowed).toBe(true);
    expect(can('createEvent').allowed).toBe(false);
  });

  it('readOnly denies everything', () => {
    setDemoOverlay({ v: 1, preset: 'readOnly', permissions: overridesForPreset('readOnly')! });
    for (const action of ['createEvent', 'enterScores', 'modifySchedule', 'createVenue'] as const) {
      expect(can(action).allowed, action).toBe(false);
    }
  });

  it('ticking a box after choosing a preset marks the posture custom', () => {
    setDemoOverlay({ v: 1, preset: 'recorder', permissions: overridesForPreset('recorder')! });
    setDemoPermission('canCreateEvents', true);
    expect(getDemoOverlay()?.preset).toBe('custom');
    expect(can('createEvent').allowed).toBe(true);
    expect(can('createDraw').allowed).toBe(false);
  });
});
