import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearDemoOverlay, setDemoOverlay } from 'services/demoMode/demoState';
import { overridesForPreset } from 'services/demoMode/demoPresets';
import { preferencesConfig } from 'config/preferencesConfig';
import { providerConfig } from 'config/providerConfig';
import {
  NAV_TAB_ACTIONS,
  canViewTab,
  firstPermittedTab,
  isTabAvailable,
  ownsTabVisibility,
  tabDenialReason,
  tabEnabledByPreference,
} from './navCapability';
import {
  TOURNAMENT_OVERVIEW,
  REGISTRATIONS_TAB,
  PUBLISHING_TAB,
  SCHEDULING_TAB,
  PARTICIPANTS,
  MATCHUPS_TAB,
  OFFICIALS_TAB,
  SETTINGS_TAB,
  VENUES_TAB,
  EVENTS_TAB,
} from 'constants/tmxConstants';

function applyPreset(preset: 'recorder' | 'scheduler' | 'registrar' | 'readOnly') {
  setDemoOverlay({ v: 1, preset, permissions: overridesForPreset(preset)! });
}

describe('navCapability', () => {
  beforeEach(() => {
    providerConfig.reset();
    preferencesConfig.reset();
    clearDemoOverlay();
  });
  afterEach(() => clearDemoOverlay());

  it('shows every tab to an unconfigured provider', () => {
    for (const tab of Object.keys(NAV_TAB_ACTIONS)) expect(canViewTab(tab), tab).toBe(true);
  });

  it('does not own the Registrations tab — it has its own richer gate', () => {
    expect(ownsTabVisibility(REGISTRATIONS_TAB)).toBe(false);
    expect(canViewTab(REGISTRATIONS_TAB)).toBe(true);
  });

  it('keeps Overview and Settings available under every posture', () => {
    applyPreset('readOnly');
    expect(canViewTab(TOURNAMENT_OVERVIEW)).toBe(true);
    expect(canViewTab(SETTINGS_TAB)).toBe(true);
  });

  // CA's case: "the venues pages should not be visible for someone who can only
  // score/schedule" — but the two halves of that answer differently.
  describe('the venues case', () => {
    it('hides Venues from a scoring-only recorder', () => {
      applyPreset('recorder');
      expect(canViewTab(VENUES_TAB)).toBe(false);
    });

    // The trap: deriving from venue CRUD alone would hide it from the person who
    // most needs it. A scheduler places matches on courts.
    it('KEEPS Venues for a scheduler, who cannot create a venue but needs the courts', () => {
      applyPreset('scheduler');
      expect(providerConfig.isAllowed('canCreateVenues')).toBe(false);
      expect(canViewTab(VENUES_TAB)).toBe(true);
    });
  });

  it('hides construction sections from a recorder but keeps what they must see', () => {
    applyPreset('recorder');
    expect(canViewTab(EVENTS_TAB)).toBe(false);
    expect(canViewTab(PARTICIPANTS)).toBe(false);
    expect(canViewTab(PUBLISHING_TAB)).toBe(false);
    // Read-useful: a recorder needs to know when and where they are playing.
    expect(canViewTab(MATCHUPS_TAB)).toBe(true);
    expect(canViewTab(SCHEDULING_TAB)).toBe(true);
  });

  it('gives a registrar the participant and event surfaces', () => {
    applyPreset('registrar');
    expect(canViewTab(PARTICIPANTS)).toBe(true);
    expect(canViewTab(EVENTS_TAB)).toBe(true);
    expect(canViewTab(VENUES_TAB)).toBe(false);
    expect(canViewTab(PUBLISHING_TAB)).toBe(false);
  });

  it('every denied tab can explain itself — the redirect toast is never silent', () => {
    applyPreset('recorder');
    for (const tab of Object.keys(NAV_TAB_ACTIONS)) {
      if (canViewTab(tab)) continue;
      expect(tabDenialReason(tab), tab).toBeTruthy();
    }
  });

  it('returns no reason for a permitted tab', () => {
    expect(tabDenialReason(MATCHUPS_TAB)).toBeUndefined();
  });

  it('always resolves a landing tab, even when everything is denied', () => {
    applyPreset('readOnly');
    const landing = firstPermittedTab();
    expect(canViewTab(landing)).toBe(true);
    expect(landing).toBe(TOURNAMENT_OVERVIEW);
  });

  it('lands a denied deep link on a tab the user can actually reach', () => {
    applyPreset('recorder');
    expect(canViewTab(VENUES_TAB)).toBe(false);
    expect(canViewTab(firstPermittedTab())).toBe(true);
  });

  it('reflects a single provider permission, not only demo presets', () => {
    providerConfig.set({ permissions: { canPublish: false, canUnpublish: false } });
    expect(canViewTab(PUBLISHING_TAB)).toBe(false);
    providerConfig.reset();
    expect(canViewTab(PUBLISHING_TAB)).toBe(true);
  });

  it('every tab action is a real capability action', () => {
    for (const [tab, actions] of Object.entries(NAV_TAB_ACTIONS)) {
      for (const action of actions) expect(typeof action, `${tab}:${action}`).toBe('string');
    }
  });
});

/**
 * The Officials board is a court-side surface most providers never staff for, so
 * it is switchable off in Settings — and off is the default.
 *
 * The distinction these tests exist to hold: a preference is NOT a permission.
 * Folding the toggle into the capability set would have been a smaller change
 * and would have made `tabDenialReason` explain a user's own choice back to them
 * as a permission refusal, in a toast.
 */
describe('the officials board preference', () => {
  beforeEach(() => {
    providerConfig.reset();
    preferencesConfig.reset();
    clearDemoOverlay();
  });
  afterEach(() => preferencesConfig.reset());

  it('is off by default, so the tab is not available', () => {
    expect(preferencesConfig.get().officialsBoard).toBe(false);
    expect(tabEnabledByPreference(OFFICIALS_TAB)).toBe(false);
    expect(isTabAvailable(OFFICIALS_TAB)).toBe(false);
  });

  it('makes the tab available once switched on', () => {
    preferencesConfig.set({ officialsBoard: true });
    expect(isTabAvailable(OFFICIALS_TAB)).toBe(true);
  });

  it('is read live, not captured at module load', () => {
    // The gate is a function per tab for this reason: the preference changes
    // while the app is running, when the user ticks the box.
    expect(isTabAvailable(OFFICIALS_TAB)).toBe(false);
    preferencesConfig.set({ officialsBoard: true });
    expect(isTabAvailable(OFFICIALS_TAB)).toBe(true);
    preferencesConfig.set({ officialsBoard: false });
    expect(isTabAvailable(OFFICIALS_TAB)).toBe(false);
  });

  it('leaves the capability answer alone, so nothing reports a denial reason', () => {
    // Permission-wise the user may absolutely see this tab; they have chosen not
    // to. `canViewTab` must keep saying so, and `tabDenialReason` must stay
    // silent — a toast reading "you lack modifySchedule" would be a lie.
    expect(canViewTab(OFFICIALS_TAB)).toBe(true);
    expect(tabDenialReason(OFFICIALS_TAB)).toBeUndefined();
  });

  it('gates only the officials tab', () => {
    // The control. A gate that returned false for everything would satisfy every
    // assertion above.
    for (const tab of Object.keys(NAV_TAB_ACTIONS)) {
      if (tab === OFFICIALS_TAB) continue;
      expect(tabEnabledByPreference(tab), tab).toBe(true);
      expect(isTabAvailable(tab), tab).toBe(true);
    }
  });

  it('a permission denial still wins when the preference is on', () => {
    // Both gates are real: switching the board on does not grant access to it.
    preferencesConfig.set({ officialsBoard: true });
    applyPreset('registrar');
    expect(tabEnabledByPreference(OFFICIALS_TAB)).toBe(true);
    expect(isTabAvailable(OFFICIALS_TAB)).toBe(canViewTab(OFFICIALS_TAB));
  });
});
