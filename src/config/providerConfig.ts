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
      | 'allowedCategories',
  ): any[] => {
    if (key === 'allowedMatchUpFormats') return current.policies?.allowedMatchUpFormats ?? [];
    if (key === 'allowedCategories') return current.policies?.allowedCategories ?? [];
    return (current.permissions?.[key as keyof ProviderPermissions] as any[]) ?? [];
  },
} as const;

function applyBranding(branding?: ProviderBranding): void {
  if (typeof document === 'undefined') return;

  if (branding?.appName) {
    document.title = branding.appName;
  }
  if (branding?.accentColor) {
    document.documentElement.style.setProperty('--tmx-accent-blue', branding.accentColor);
  }
  updateNavbarBranding(branding);
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
    providerDiv.innerHTML = '';
    providerDiv.appendChild(img);
  } else {
    const appName = branding?.appName ?? 'TMX';
    const existing = providerDiv.querySelector('div');
    if (existing) {
      existing.textContent = appName;
    }
  }
}
