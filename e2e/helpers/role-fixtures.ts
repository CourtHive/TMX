import type { APIRequestContext } from '@playwright/test';

/**
 * Server-side fixtures for the role-gating journey (real login, not token
 * injection — TMX's authenticated boot is server-coupled, so the JWT must come
 * from a genuine /auth/login). Seeds providers / role-scoped users / a
 * provisioner via the admin API, as a super-admin.
 *
 * Bootstrap super-admin defaults to the dedicated e2e account the admin-client
 * suite provisions; override via env. If it can't authenticate, the caller
 * should test.skip the journey (mirrors journey 28's reachability skip) rather
 * than fail CI when the seed admin is absent.
 */
export const SERVER = process.env.E2E_API_BASE ?? 'http://localhost:8383';
export const SUPERADMIN_EMAIL = process.env.E2E_SUPERADMIN_EMAIL ?? 'e2e-admin@courthive.test';
export const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD ?? 'e2e-test-password-do-not-reuse';
export const ROLE_PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'e2e-role-password-do-not-reuse';

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * Returns a super-admin JWT, or null if the bootstrap admin can't authenticate.
 *
 * Warns with the STATUS on failure. Every caller turns a null into `test.skip(...)` worded as
 * "seed unavailable", which reads as "this machine has no bootstrap account" — and that is usually
 * not the cause. `/auth/login` is throttled at **10 requests per 60s**, and the real-login journeys
 * spend roughly two logins each (one here, one through the UI), so a few of them back to back —
 * or one run with retries — reliably returns **429** and skips whole files. A silent skip on a
 * rate limit is a false all-clear: the suite reports green having tested nothing.
 */
export async function signInSuperAdmin(request: APIRequestContext): Promise<string | null> {
  try {
    const res = await request.post(`${SERVER}/auth/login`, {
      data: { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD },
      timeout: 5000,
    });
    if (!res.ok()) {
      const hint = res.status() === 429 ? ' — login throttle (10/60s); re-run after a pause' : '';
      console.warn(`signInSuperAdmin: POST ${SERVER}/auth/login → ${res.status()}${hint}`);
      return null;
    }
    const body = await res.json();
    if (!body?.token) console.warn(`signInSuperAdmin: 200 with no token (keys: ${Object.keys(body ?? {})})`);
    return body?.token ?? null;
  } catch (err: any) {
    console.warn(`signInSuperAdmin: ${SERVER} unreachable — ${err?.message ?? err}`);
    return null;
  }
}

export async function ensureProvider(
  request: APIRequestContext,
  token: string,
  organisationAbbreviation: string,
  organisationName: string,
): Promise<string> {
  const addRes = await request.post(`${SERVER}/provider/add`, {
    headers: authHeaders(token),
    data: { organisationAbbreviation, organisationName },
  });
  const addBody = await addRes.json().catch(() => ({}));
  if (addBody?.providerId) return addBody.providerId;

  const listRes = await request.post(`${SERVER}/provider/allproviders`, { headers: authHeaders(token) });
  const listBody = await listRes.json();
  const match = (listBody?.providers ?? []).find(
    (p: any) => p?.value?.organisationAbbreviation === organisationAbbreviation,
  );
  const providerId = match?.value?.organisationId;
  if (!providerId) throw new Error(`ensureProvider(${organisationAbbreviation}): ${JSON.stringify(addBody)}`);
  return providerId;
}

export interface CreateUserOpts {
  email: string;
  roles?: string[];
  providerId?: string;
  providerRole?: 'PROVIDER_ADMIN' | 'DIRECTOR';
}

/** Create a login-ready user (clears the forced first-login password change). */
export async function createLoginableUser(
  request: APIRequestContext,
  token: string,
  opts: CreateUserOpts,
): Promise<void> {
  const createRes = await request.post(`${SERVER}/auth/admin-create-user`, {
    headers: authHeaders(token),
    data: {
      email: opts.email,
      password: ROLE_PASSWORD,
      roles: opts.roles ?? [],
      providerId: opts.providerId,
      providerRole: opts.providerRole,
    },
  });
  if (!createRes.ok()) {
    throw new Error(`admin-create-user(${opts.email}) failed (${createRes.status()}): ${await createRes.text()}`);
  }
  const loginRes = await request.post(`${SERVER}/auth/login`, {
    data: { email: opts.email, password: ROLE_PASSWORD },
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (loginBody?.limitedToken) {
    const completeRes = await request.post(`${SERVER}/auth/complete-first-login`, {
      data: { limitedToken: loginBody.limitedToken, newPassword: ROLE_PASSWORD },
    });
    if (!completeRes.ok()) {
      throw new Error(`complete-first-login(${opts.email}) failed (${completeRes.status()})`);
    }
  }
}

export async function removeUser(request: APIRequestContext, token: string, email: string): Promise<void> {
  if (!email) return;
  await request.post(`${SERVER}/auth/remove`, { headers: authHeaders(token), data: { email } });
}

export async function createProvisioner(request: APIRequestContext, token: string, name: string): Promise<string> {
  const res = await request.post(`${SERVER}/admin/provisioners`, { headers: authHeaders(token), data: { name } });
  if (!res.ok()) throw new Error(`create provisioner(${name}) failed (${res.status()})`);
  const body = await res.json();
  const id = body?.provisionerId ?? body?.id ?? body?.provisioner?.provisionerId ?? body?.provisioner?.id;
  if (!id) throw new Error(`create provisioner(${name}): no id in ${JSON.stringify(body)}`);
  return id;
}

export async function associateProviderToProvisioner(
  request: APIRequestContext,
  token: string,
  provisionerId: string,
  providerId: string,
): Promise<void> {
  const res = await request.post(`${SERVER}/admin/provisioners/${provisionerId}/providers`, {
    headers: authHeaders(token),
    data: { providerId, relationship: 'owner' },
  });
  if (!res.ok()) throw new Error(`associate provider failed (${res.status()})`);
}

export async function assignProvisionerRep(
  request: APIRequestContext,
  token: string,
  provisionerId: string,
  email: string,
): Promise<void> {
  const res = await request.post(`${SERVER}/admin/provisioners/${provisionerId}/users`, {
    headers: authHeaders(token),
    data: { email },
  });
  if (!res.ok()) throw new Error(`assign rep(${email}) failed (${res.status()})`);
}

export async function cleanupProvisioner(
  request: APIRequestContext,
  token: string,
  provisionerId: string,
): Promise<void> {
  if (!provisionerId) return;
  await request.put(`${SERVER}/admin/provisioners/${provisionerId}`, {
    headers: authHeaders(token),
    data: { isActive: false },
  });
  await request.delete(`${SERVER}/admin/provisioners/${provisionerId}`, { headers: authHeaders(token) });
}

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * A short, unique provider abbreviation for a single e2e run.
 *
 * `ensureProvider` keys on `organisationAbbreviation`, so a FIXED abbreviation
 * makes the seed non-idempotent: a repeat local run finds the prior run's
 * provider (with its stale name) instead of creating a fresh one, and any spec
 * that selects the provider by its freshly-suffixed name times out. A unique
 * abbreviation per run sidesteps that entirely. The `E2E` prefix keeps these in
 * scope of CFS's cleanup-test-data.mjs (which matches abbreviation LIKE 'E2E%').
 * Kept short (~8 chars) so it renders cleanly in the provider badge.
 */
export function uniqueAbbr(tag = ''): string {
  const t = Date.now().toString(36).slice(-4);
  const r = Math.floor(Math.random() * 46_656).toString(36); // up to 3 base-36 chars
  return `E2E${tag}${t}${r}`.toUpperCase();
}
