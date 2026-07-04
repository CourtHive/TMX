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

import type {
  ProviderBranding,
  ProviderConfigData,
  ProviderPermissions,
} from '@courthive/provider-config';
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
  canCreateEvents: true,
  canDeleteEvents: true,
  canModifyEventFormat: true,
  canCreateDraws: true,
  canDeleteDraws: true,
  canUseDraftPositioning: true,
  canUseManualPositioning: true,
  allowedDrawTypes: [],
  allowedCreationMethods: [],
  canModifySchedule: true,
  canUseBulkScheduling: true,
  canCreateVenues: true,
  canDeleteVenues: true,
  canModifyCourtAvailability: true,
  canEnterScores: true,
  canModifyCompletedScores: false,
  allowedScoringApproaches: [],
  canPublish: true,
  canUnpublish: true,
  canModifyTournamentDetails: true,
  canModifyPolicies: true,
  canAccessProviderAdmin: false,
  canUseChat: true,
};

let current: ProviderConfigData = {};

export const providerConfig = {
  get: (): Readonly<ProviderConfigData> => current,
  set: (config: ProviderConfigData) => {
    current = { ...current, ...config };
    applyBranding(current.branding);
  },
  reset: () => {
    current = {};
    applyBranding(undefined);
  },
  isAllowed: (key: keyof ProviderPermissions): boolean => {
    const val = current.permissions?.[key] ?? DEFAULT_PERMISSIONS[key];
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
    if (key === 'allowedMatchUpFormats') return current.policies?.allowedMatchUpFormats ?? [];
    if (key === 'allowedCategories') return current.policies?.allowedCategories ?? [];
    if (key === 'allowedTierSystems') return current.policies?.allowedTierSystems ?? [];
    return (current.permissions?.[key as keyof ProviderPermissions] as any[]) ?? [];
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
