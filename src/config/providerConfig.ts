/**
 * Provider configuration runtime singleton — white labeling, feature
 * governance, and policy defaults for the live TMX session.
 *
 * Types and KEYS arrays are owned by `@courthive/provider-config`. This
 * file is just the in-memory store + DOM side-effects layer.
 *
 * Usage:
 *   import { providerConfig } from 'config/providerConfig';
 *   providerConfig.get().permissions?.canCreateCompetitors  // boolean | undefined
 *   providerConfig.isAllowed('canCreateCompetitors')        // boolean
 */

import type { ProviderBranding, ProviderConfigData, ProviderPermissions } from '@courthive/provider-config';
import { demoVersion, getDemoOverlay } from 'services/demoMode/demoState';
import { intersectPermissions } from 'services/demoMode/intersect';
import { context } from 'services/context';

export type { ProviderBranding, ProviderConfigData, ProviderPermissions };

// Default permissions — permissive (boolean keys default to `true` except
// for the two listed in PERMISSIONS_DEFAULT_FALSE; array keys default to
// empty = unrestricted).
const DEFAULT_PERMISSIONS: Required<ProviderPermissions> = {
  canCreateCompetitors: true,
  canCreateOfficials: true,
  canDeleteParticipants: true,
  canImportParticipants: true,
  canEditParticipantDetails: true,
  canModifyEntries: true,
  canModifyRatings: true,
  canCreateEvents: true,
  canDeleteEvents: true,
  canModifyEventFormat: true,
  canCreateDraws: true,
  canDeleteDraws: true,
  canUseDraftPositioning: true,
  canUseManualPositioning: true,
  canAssignPositions: true,
  canModifyStructures: true,
  allowedDrawTypes: [],
  allowedCreationMethods: [],
  canModifySchedule: true,
  canUseBulkScheduling: true,
  canModifyScheduleScenarios: true,
  canCreateVenues: true,
  canDeleteVenues: true,
  canModifyCourtAvailability: true,
  canManagePracticeCourts: true,
  canEnterScores: true,
  canModifyCompletedScores: false,
  allowedScoringApproaches: [],
  canPublish: true,
  canUnpublish: true,
  canModifyTournamentDetails: true,
  canModifyPolicies: true,
  canLinkTournaments: true,
  canAccessProviderAdmin: false,
  canUseChat: true,
};

let current: ProviderConfigData = {};
let configVersion = 0;

// Memoized composition of `current` with the demo overlay. `get()` returned a
// stable reference before the overlay existed and there are ~a dozen per-render
// readers, so rebuilding on every call would churn. Keyed on (config, demo).
let composed: ProviderConfigData = current;
let composedKey = '';

function resolved(): Readonly<ProviderConfigData> {
  const overlay = getDemoOverlay();
  const key = `${configVersion}:${demoVersion()}`;
  if (key === composedKey) return composed;
  composedKey = key;
  composed = overlay
    ? { ...current, permissions: intersectPermissions(current.permissions, overlay.permissions) }
    : current;
  return composed;
}

export const providerConfig = {
  get: (): Readonly<ProviderConfigData> => resolved(),
  set: (config: ProviderConfigData) => {
    current = { ...current, ...config };
    configVersion += 1;
    applyBranding(current.branding);
  },
  // NOTE: reset() deliberately does NOT clear the demo overlay. The overlay is a
  // separate layer with its own lifecycle (cleared on login/logout), and reset()
  // runs on every provider switch — clearing here would silently drop the demo
  // posture mid-demonstration, the same shape as the documented "switch to
  // BOBOCA still shows INTENNSE" branding bug.
  reset: () => {
    current = {};
    configVersion += 1;
    applyBranding(undefined);
  },
  isAllowed: (key: keyof ProviderPermissions): boolean => {
    const val = resolved().permissions?.[key] ?? DEFAULT_PERMISSIONS[key];
    if (typeof val === 'boolean') return val;
    return true;
  },
  getAllowedList: (
    key:
      | 'allowedDrawTypes'
      | 'allowedCreationMethods'
      | 'allowedScoringApproaches'
      | 'allowedMatchUpFormats'
      | 'allowedCategories'
      | 'allowedTierSystems',
  ): any[] => {
    const active = resolved();
    if (key === 'allowedMatchUpFormats') return active.policies?.allowedMatchUpFormats ?? [];
    if (key === 'allowedCategories') return active.policies?.allowedCategories ?? [];
    if (key === 'allowedTierSystems') return active.policies?.allowedTierSystems ?? [];
    return (active.permissions?.[key as keyof ProviderPermissions] as any[]) ?? [];
  },
} as const;

const PROVIDER_THEME_LINK_ID = 'tmx-provider-theme';
const PROVIDER_TOKEN_ATTR = 'data-tmx-provider-tokens';

function applyBranding(branding?: ProviderBranding): void {
  if (typeof document === 'undefined') return;

  if (branding?.appName) {
    document.title = branding.appName;
  }
  if (branding?.accentColor) {
    document.documentElement.style.setProperty('--tmx-accent-blue', branding.accentColor);
  }
  applyThemeTokens(branding?.themeTokens);
  applyProviderStylesheet(branding?.stylesheetUrl);
  updateNavbarBranding(branding);
}

// Track which custom properties this layer applied so provider switches
// remove the prior set cleanly, leaving the bundled CSS defaults in place.
function applyThemeTokens(tokens?: Record<string, string>): void {
  const root = document.documentElement;

  const priorList = root.getAttribute(PROVIDER_TOKEN_ATTR);
  if (priorList) {
    for (const prior of priorList.split(' ')) {
      if (prior) root.style.removeProperty(prior);
    }
    root.removeAttribute(PROVIDER_TOKEN_ATTR);
  }

  if (!tokens) return;

  const applied: string[] = [];
  for (const [token, value] of Object.entries(tokens)) {
    root.style.setProperty(token, value);
    applied.push(token);
  }
  if (applied.length > 0) {
    root.setAttribute(PROVIDER_TOKEN_ATTR, applied.join(' '));
  }
}

function applyProviderStylesheet(url?: string): void {
  const existing = document.getElementById(PROVIDER_THEME_LINK_ID) as HTMLLinkElement | null;

  if (!url) {
    if (existing) existing.remove();
    return;
  }

  if (existing) {
    if (existing.getAttribute('href') !== url) existing.setAttribute('href', url);
    return;
  }

  const link = document.createElement('link');
  link.id = PROVIDER_THEME_LINK_ID;
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

function updateNavbarBranding(branding?: ProviderBranding): void {
  if (typeof document === 'undefined') return;
  const providerDiv = document.getElementById('provider');
  if (!providerDiv) return;

  if (branding?.navbarLogoUrl) {
    const img = document.createElement('img');
    img.src = branding.navbarLogoUrl;
    img.alt = branding.navbarLogoAlt ?? 'Logo';
    img.style.maxHeight = `${branding.navbarLogoHeight ?? 32}px`;
    img.style.objectFit = 'contain';
    providerDiv.replaceChildren(img);
    return;
  }

  // No custom logo: render a text label. Prefer the provider's branding
  // appName, then the active provider's abbreviation, then 'TMX'. Always
  // rebuild the inner node (replaceChildren) so a prior provider's logo <img>
  // or stale text can't survive a switch to a provider that defines no
  // navbar branding — the "still shows INTENNSE" bug.
  const label = branding?.appName ?? context.provider?.organisationAbbreviation ?? 'TMX';
  const div = document.createElement('div');
  div.style.fontSize = '.6em';
  div.textContent = label;
  providerDiv.replaceChildren(div);
}
