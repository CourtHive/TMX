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
  roles: string[];
  permissions: string[];
  services: string[];
  provider?: ProviderValue;
  providerId?: string;
  providerIds?: string[];
  exp: number;
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
