/**
 * Policy reads, served by courthive-ams.
 *
 * Policy hosting moved from CFS to AMS on 2026-09-23 (AMS migrations 0096/0097), because that is
 * where sanctioning lives and where a provider's policies are attached to a tournament when its
 * sanctioning record is approved. CFS no longer serves `/policies` at all.
 *
 * TWO AUDIENCES, deliberately different:
 *
 *  - **Not logged in (demo).** The catalog — `SHARED_DEMO` and `TEMPLATE_REF` policies — is public,
 *    so a demo session can browse it and apply a policy to a tournament it runs locally. No token
 *    is required and none is sent.
 *  - **Logged in with a provider.** `fetchMyPolicies` additionally returns that provider's own
 *    `PROVIDER_PRIVATE` policies, so a director can see the ranking-points policy their live
 *    derivations actually run under. `rankingPoints` policies are never attached to tournaments —
 *    they drive back-end pipelines — which is exactly why being able to READ them here matters.
 *
 * Base URL: `VITE_AMS_URL` (build-time) → localhost-aware fallback, resolved by `facilitiesApi`
 * so every AMS caller in TMX agrees on one answer.
 */
import { authHeaders, getAmsBaseUrl } from './facilitiesApi';

export type PolicyVisibility = 'PROVIDER_PRIVATE' | 'SHARED_DEMO' | 'TEMPLATE_REF';

export interface CatalogPolicy {
  policyId: string;
  providerId: string | null;
  policyType: string;
  name: string;
  version: string;
  visibility: PolicyVisibility;
  definition: any;
  metadata?: any;
  publishedAt: string;
  publishedBy?: string | null;
}

async function readPolicies(path: string, headers: Record<string, string>, signal?: AbortSignal) {
  const res = await fetch(`${getAmsBaseUrl()}${path}`, { headers, signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { policies?: CatalogPolicy[] };
  return Array.isArray(body?.policies) ? body.policies : [];
}

/**
 * The public catalog: globally readable policies, no authentication.
 *
 * Sent WITHOUT an Authorization header on purpose. The route is `@Public()` on AMS, and a demo
 * session has no token to send — passing one it happens to hold would make the demo path behave
 * differently for a logged-in user than for the audience it exists to serve.
 */
export function fetchPolicyCatalog(signal?: AbortSignal): Promise<CatalogPolicy[]> {
  return readPolicies('/policies/catalog', { 'Content-Type': 'application/json' }, signal);
}

/**
 * Every policy the signed-in session may see: its provider's own, plus the public catalog.
 *
 * AMS merges and de-duplicates the two, so this is not the catalog plus a second call.
 */
export function fetchMyPolicies(signal?: AbortSignal): Promise<CatalogPolicy[]> {
  return readPolicies('/policies', authHeaders(), signal);
}
