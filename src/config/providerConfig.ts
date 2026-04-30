/**
 * Provider configuration — white labeling, feature governance, and policy defaults.
 *
 * Delivered from the server per-provider at login. Governs branding, restricts
 * UI surfaces, and pre-populates policy defaults for tournament directors.
 *
 * Usage:
 *   import { providerConfig } from 'config/providerConfig';
 *   providerConfig.get().permissions.canCreateCompetitors  // boolean
 *   providerConfig.isAllowed('canCreateCompetitors')       // shorthand
 */

// ── Types ──

export interface ProviderBranding {
  /** URL or data-URI for navbar logo (replaces "TMX" text) */
  navbarLogoUrl?: string;
  /** Alt text for navbar logo */
  navbarLogoAlt?: string;
  /** Max height in px for navbar logo (default: 32) */
  navbarLogoHeight?: number;
  /** URL or data-URI for splash/login screen logo (replaces CourtHive hex) */
  splashLogoUrl?: string;
  /** Application name shown in page title and nav bar (default: "TMX") */
  appName?: string;
  /** Optional accent color override (CSS color value) */
  accentColor?: string;
}

export interface ProviderPermissions {
  // ── Participants ──
  canCreateCompetitors?: boolean;
  canCreateOfficials?: boolean;
  canDeleteParticipants?: boolean;
  canImportParticipants?: boolean;
  canEditParticipantDetails?: boolean;

  // ── Events ──
  canCreateEvents?: boolean;
  canDeleteEvents?: boolean;
  canModifyEventFormat?: boolean;

  // ── Draws ──
  canCreateDraws?: boolean;
  canDeleteDraws?: boolean;
  canUseDraftPositioning?: boolean;
  canUseManualPositioning?: boolean;
  /** Restrict draw types to this list (factory drawType constants). Empty = all allowed. */
  allowedDrawTypes?: string[];
  /** Restrict creation methods. Empty = all allowed. */
  allowedCreationMethods?: string[];

  // ── Scheduling ──
  canModifySchedule?: boolean;
  canUseBulkScheduling?: boolean;

  // ── Venues ──
  canCreateVenues?: boolean;
  canDeleteVenues?: boolean;
  canModifyCourtAvailability?: boolean;

  // ── Scoring ──
  canEnterScores?: boolean;
  canModifyCompletedScores?: boolean;
  allowedScoringApproaches?: string[];

  // ── Publishing ──
  canPublish?: boolean;
  canUnpublish?: boolean;

  // ── Settings ──
  canModifyTournamentDetails?: boolean;
  canModifyPolicies?: boolean;
  canAccessProviderAdmin?: boolean;
}

/**
 * Per-print-type composition policies. Keys are pdf-factory PrintType
 * values; values are partial CompositionConfig overrides. Resolved at
 * print time via pdf-factory's `resolveCompositionConfig` helper.
 */
export type PrintPoliciesByType = Record<string, unknown>;

export interface ProviderPolicyDefaults {
  /** Scheduling policy applied to new tournaments */
  schedulingPolicy?: any;
  /** Scoring policy */
  scoringPolicy?: any;
  /** Seeding policy */
  seedingPolicy?: any;
  /** Restrict matchUp formats to this list (format codes) */
  allowedMatchUpFormats?: string[];
  /** Restrict event categories to this list */
  allowedCategories?: Array<{
    ageCategoryCode: string;
    categoryName?: string;
  }>;
  /** Per-print-type composition policies (pdf-factory CompositionConfig per type) */
  printPolicies?: PrintPoliciesByType;
}

export interface ProviderDefaults {
  /** Default event type for new events */
  defaultEventType?: string;
  /** Default draw type for new draws */
  defaultDrawType?: string;
  /** Default creation method */
  defaultCreationMethod?: string;
  /** Default gender */
  defaultGender?: string;
}

export interface ProviderConfigData {
  branding?: ProviderBranding;
  permissions?: ProviderPermissions;
  policies?: ProviderPolicyDefaults;
  defaults?: ProviderDefaults;
}

// ── Canonical key enumerations ──
//
// MIRROR of the canonical lists in
// `competition-factory-server/src/modules/providers/provider-config.types.ts`.
// A contract test (`providerConfig.contract.test.ts`) asserts these arrays
// stay in lockstep. When a permission key is added on the server side, both
// this file and the contract test's canonical list must be updated together.

export const BOOLEAN_PERMISSION_KEYS = [
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
] as const satisfies ReadonlyArray<keyof ProviderPermissions>;

export const ARRAY_PERMISSION_KEYS = [
  'allowedDrawTypes',
  'allowedCreationMethods',
  'allowedScoringApproaches',
] as const satisfies ReadonlyArray<keyof ProviderPermissions>;

export const PERMISSIONS_DEFAULT_FALSE: ReadonlySet<keyof ProviderPermissions> = new Set([
  'canModifyCompletedScores',
  'canAccessProviderAdmin',
]);

// ── Default permissions (all allowed) ──

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

// ── Module state ──

let current: ProviderConfigData = {};

// ── Public API ──

export const providerConfig = {
  /** Get the full config (read-only). */
  get: (): Readonly<ProviderConfigData> => current,

  /** Set/merge provider config (typically called on login). */
  set: (config: ProviderConfigData) => {
    current = { ...current, ...config };
    applyBranding(current.branding);
  },

  /** Reset to defaults (e.g. on logout). */
  reset: () => {
    current = {};
    applyBranding(undefined);
  },

  /**
   * Check a boolean permission. Returns true if allowed (default).
   * For permissions not set in the config, falls back to DEFAULT_PERMISSIONS.
   */
  isAllowed: (key: keyof ProviderPermissions): boolean => {
    const val = current.permissions?.[key] ?? DEFAULT_PERMISSIONS[key];
    // For boolean permissions, return the value directly
    if (typeof val === 'boolean') return val;
    // For array permissions (allowedDrawTypes etc.), true means "has entries" or "unrestricted"
    return true;
  },

  /**
   * Get an array permission value. Returns empty array if unrestricted.
   */
  getAllowedList: (key: 'allowedDrawTypes' | 'allowedCreationMethods' | 'allowedScoringApproaches' | 'allowedMatchUpFormats' | 'allowedCategories'): any[] => {
    if (key === 'allowedMatchUpFormats') return current.policies?.allowedMatchUpFormats ?? [];
    if (key === 'allowedCategories') return current.policies?.allowedCategories ?? [];
    return (current.permissions?.[key as keyof ProviderPermissions] as any[]) ?? [];
  },
} as const;

// ── Branding side-effects ──

function applyBranding(branding?: ProviderBranding): void {
  if (typeof document === 'undefined') return; // No DOM in test environment

  // App name in document title
  if (branding?.appName) {
    document.title = branding.appName;
  }

  // Accent color override
  if (branding?.accentColor) {
    document.documentElement.style.setProperty('--tmx-accent-blue', branding.accentColor);
  }

  // Navbar logo — handled by rootBlock reading providerConfig at render time
  // Splash logo — handled by rootBlock reading providerConfig at render time
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
