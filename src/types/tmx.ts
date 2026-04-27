/**
 * Core TMX type definitions.
 *
 * These interfaces describe the shapes that flow through the application:
 * - LoginState: the decoded JWT returned by getLoginState()
 * - Provider/User records: what the server APIs return
 * - API response wrappers: typed axios response shapes
 */

// ---------------------------------------------------------------------------
// Authentication / JWT
// ---------------------------------------------------------------------------

/** Decoded JWT token returned by `getLoginState()` via `validateToken()`. */
export interface LoginState {
  email: string;
  userId?: string;
  roles: string[];
  permissions: string[];
  services: string[];
  provider?: ProviderValue;
  providerId?: string;
  providerIds?: string[];
  /**
   * Effective provider config (caps ∩ settings) computed server-side at login.
   * TMX consumes this directly via `providerConfig.set()` — see
   * `Mentat/planning/TMX_PROVIDER_CONFIG_FEATURES.md`. Typed loosely as `any`
   * here because the canonical shape lives in `config/providerConfig.ts` and
   * importing it would create a circular dependency through this types file.
   */
  activeProviderConfig?: any;
  exp: number;
}

/**
 * Multi-provider user context returned by `GET /auth/me`.
 * Provider-scoped roles are resolved from the `user_providers` table at
 * request time — they are NOT in the JWT, so role changes take effect
 * immediately without forced re-login.
 */
export interface UserContext {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  globalRoles: string[];
  /** Per-provider role map, keyed by providerId. */
  providerRoles: Record<string, string>;
  /** Convenience: Object.keys(providerRoles). */
  providerIds: string[];
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface OnlineResource {
  name: string;
  resourceType: string;
  resourceSubType: string;
  identifier: string;
}

/** The value object inside a provider record. Also used for `context.provider`. */
export interface ProviderValue {
  organisationId: string;
  organisationName?: string;
  organisationAbbreviation?: string;
  onlineResources?: OnlineResource[];
  facilityService?: string;
  facilityLookup?: string;
}

/** A single provider as returned by `getProviders()`. */
export interface ProviderRecord {
  key: string;
  value: ProviderValue;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/** The value object inside a user record. */
export interface UserValue {
  email: string;
  firstName: string;
  lastName: string;
  roles?: string[];
  permissions?: string[];
  services?: string[];
  providerId?: string;
}

/** A single user as returned by `getUsers()`. */
export interface UserRecord {
  key: string;
  value: UserValue;
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface ProvidersResponse {
  data: { providers: ProviderRecord[] };
}

export interface UsersResponse {
  data: { users: UserRecord[] };
}

export interface InviteResponse {
  data: { inviteCode?: string };
}
