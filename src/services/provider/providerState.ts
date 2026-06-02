/**
 * Active provider context with localStorage persistence.
 *
 * The persisted key is shared with the admin-client app so super-admins
 * can impersonate from /admin and have TMX pick up the selection on load.
 *
 * Multi-provider users (e.g. clubx@ionsport.com with both ION and BOBOCA
 * associations) get the same persistence path plus a server-side echo via
 * `PATCH /auth/me/last-selected-provider` so the choice survives across
 * devices and browser-cache clears. See
 * Mentat/planning/MULTI_PROVIDER_SESSION_CONTEXT.md.
 */
import { providerConfig } from 'config/providerConfig';
import { ensurePdfFontReady } from 'services/pdf/pdfFont';
import { getLoginState } from 'services/authentication/loginState';
import { baseApi } from 'services/apis/baseApi';
import { context } from 'services/context';

import type { LoginState, ProviderValue } from 'types/tmx';

import { SUPER_ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

export const IMPERSONATED_PROVIDER_KEY = 'tmx_impersonated_provider';

type SetActiveProviderOptions = {
  /** Echo to the server via PATCH /auth/me/last-selected-provider so the
   *  selection survives across devices. Default `true` for explicit user
   *  picks; pass `false` for boot-path restorations (no need to re-write
   *  a value the server just sent us). */
  persistServer?: boolean;
};

export function setActiveProvider(provider: ProviderValue, options: SetActiveProviderOptions = {}): void {
  const persistServer = options.persistServer !== false;
  context.provider = provider;
  try {
    globalThis.localStorage?.setItem(IMPERSONATED_PROVIDER_KEY, JSON.stringify(provider));
  } catch {
    /* localStorage unavailable (private mode / SSR) — non-fatal */
  }
  if (persistServer && provider?.organisationId) {
    // Fire-and-forget — the server-side echo is for cross-device persistence,
    // not session correctness. Local context is already updated.
    patchLastSelectedProvider(provider.organisationId).catch(() => {
      /* non-fatal — local state still drives the session */
    });
  }
  updateProviderBranding();
  // Refetch the impersonated provider's effective config and re-apply.
  // Fire-and-forget — the calendar/route reload below is the visible work,
  // and providerConfig.set() repaints branding + re-evaluates permission
  // gates on the next render.
  if (provider?.organisationId) {
    fetchEffectiveConfig(provider.organisationId).then(
      (effective) => {
        if (effective) providerConfig.set(effective);
        // Re-resolve the PDF font for the newly impersonated provider's default.
        void ensurePdfFontReady();
      },
      () => {
        /* fetch failure — keep prior providerConfig (better than wiping) */
      },
    );
  }
}

async function fetchEffectiveConfig(providerId: string): Promise<any | undefined> {
  // `silenceErrors` suppresses the global axios toast on 403 — the impersonation
  // handoff path naturally produces a 403 when the impersonated provider is
  // refreshed before the provisioner-inheritance fields propagate. The catch
  // in the caller already handles the failure (keeps prior providerConfig),
  // and a noisy toast on every impersonation switch is worse than the
  // (already invisible) silent fall-through.
  const response = await baseApi.get(`/provider/${providerId}/effective-config`, { silenceErrors: true } as any);
  return response?.data?.effective;
}

export function clearActiveProvider(): void {
  context.provider = undefined;
  try {
    globalThis.localStorage?.removeItem(IMPERSONATED_PROVIDER_KEY);
  } catch {
    /* non-fatal */
  }
  updateProviderBranding();
}

export function getActiveProvider(): ProviderValue | undefined {
  return context.provider;
}

export function readPersistedProvider(): ProviderValue | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(IMPERSONATED_PROVIDER_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.organisationId) return parsed as ProviderValue;
    return undefined;
  } catch {
    return undefined;
  }
}

export function getProviderAssociations() {
  return getLoginState()?.providerAssociations ?? [];
}

/** Providers managed by the user's provisioner(s); admin-equivalent in TMX. */
export function getProvisionerProviders() {
  return getLoginState()?.provisionerProviders ?? [];
}

/**
 * Resolve the initial active provider for a multi-provider user. Precedence:
 *   1. tmx_impersonated_provider in localStorage with full identity fields
 *      (impersonation handoff from /admin — super-admins and provisioner
 *      admins may not have a direct user_providers row for the impersonated
 *      provider, so we honor the persisted value without an association
 *      lookup). For a multi-provider user picking their own provider the
 *      persisted value still represents a valid pick.
 *   2. JWT `lastSelectedProviderId` (server-persisted last pick — survives
 *      cross-device / cache clears, populated by the PATCH endpoint)
 *   3. Legacy `users.provider_id` from the JWT (today's default for users
 *      with no explicit pick yet)
 *   4. First association alphabetically (last-resort default)
 *
 * Tiers 2–4 validate against the current associations array — drops stale
 * picks where the user's role was revoked between sessions. Tier 1 cannot
 * validate that way (impersonation is by design out-of-band of the user's
 * own associations) — server-side guards on each API call are the safety
 * net there; a no-longer-authorized impersonation manifests as 403s.
 */
export function resolveInitialProvider(): ProviderValue | undefined {
  const login = getLoginState();
  if (!login) return undefined;
  const associations = login.providerAssociations ?? [];

  const persisted = readPersistedProvider();
  if (persisted?.organisationId && persisted.organisationName && persisted.organisationAbbreviation) {
    // Validate against the *current* login before honoring. Defense in
    // depth: logIn() clears the persisted value on every active sign-in,
    // but a cross-tab session or any code path that establishes a session
    // without going through logIn() (e.g. silent refresh on a freshly
    // opened tab where the previous user's localStorage survived) could
    // still leak a stale impersonation. Accept only when the current user
    // could legitimately have picked this provider themselves:
    //   - super-admin (can impersonate any provider),
    //   - provisioner-admin for the persisted provider (out-of-band
    //     impersonation is a provisioner privilege; same exemption applies
    //     here as in admin-side flows), or
    //   - has a direct user_providers association with it.
    // Anything else is a stale-handoff leak; drop the value (clearing
    // localStorage so subsequent loads don't keep tripping) and fall
    // through to the JWT-driven precedence chain below.
    if (canUsePersistedProvider(login, persisted.organisationId, associations)) {
      return persisted;
    }
    try {
      globalThis.localStorage?.removeItem(IMPERSONATED_PROVIDER_KEY);
    } catch {
      /* non-fatal */
    }
  }

  if (associations.length === 0) return undefined;

  const lookup = (providerId: string | null | undefined): ProviderValue | undefined => {
    if (!providerId) return undefined;
    const hit = associations.find((a) => a.providerId === providerId);
    if (!hit) return undefined;
    return {
      organisationId: hit.providerId,
      organisationName: hit.organisationName,
      organisationAbbreviation: hit.organisationAbbreviation,
    } as ProviderValue;
  };

  return (
    lookup(login.lastSelectedProviderId) ??                // 2
    lookup(login.providerId) ??                            // 3
    (() => {                                                // 4
      const first = [...associations].sort((a, b) =>
        a.organisationName.localeCompare(b.organisationName),
      )[0];
      return {
        organisationId: first.providerId,
        organisationName: first.organisationName,
        organisationAbbreviation: first.organisationAbbreviation,
      } as ProviderValue;
    })()
  );
}

/**
 * Is the persisted provider value still legitimate for the current login?
 * See the call site in `resolveInitialProvider` for the rationale — this
 * is the validation that prevents a stale super-admin impersonation
 * handoff from leaking into a subsequent user's session.
 */
function canUsePersistedProvider(
  login: LoginState,
  providerId: string,
  associations: Array<{ providerId: string }>,
): boolean {
  if (login.roles?.includes(SUPER_ADMIN)) return true;
  if (login.provisionerProviders?.some((p) => p.providerId === providerId)) return true;
  return associations.some((a) => a.providerId === providerId);
}

async function patchLastSelectedProvider(providerId: string | null): Promise<void> {
  await baseApi.patch('/auth/me/last-selected-provider', { providerId });
}

function updateProviderBranding(): void {
  const el = document.getElementById('provider');
  const stopBtn = document.getElementById('h-stop-impersonating');
  const provider = context.provider;

  if (el) {
    if (provider?.organisationAbbreviation) {
      el.innerHTML = `<div style="font-size: .6em">${provider.organisationAbbreviation}</div>`;
      el.title = provider.organisationName ?? '';
    } else {
      el.innerHTML = `<div style="font-size: .6em">TMX</div>`;
      el.title = '';
    }
  }

  if (stopBtn) {
    // The "stop impersonating" X is meant for super-admins (or provisioner
    // admins) who are viewing a provider they have no direct association
    // with — clicking it drops them back to the unscoped TMX view. For a
    // user operating in one of their *own* associated providers it makes
    // no sense: charles@intennse.com (single INTENNSE association) is not
    // impersonating anyone by being in INTENNSE; clicking the X just
    // wipes their provider context and leaves them unable to fetch their
    // tournaments (no provider scope = denied at the server). Same goes
    // for a multi-provider user (e.g. clubx@ionsport.com) actively
    // switching between ION and BOBOCA — both are theirs, neither is
    // impersonation, and the switcher is the right control there.
    //
    // Hide unless the active provider is genuinely out-of-band: not in
    // the user's direct associations. (Super-admins typically have no
    // associations at all, so any active provider qualifies.)
    if (provider?.organisationAbbreviation && isImpersonating(provider.organisationId)) {
      stopBtn.style.display = '';
      stopBtn.onclick = () => {
        clearActiveProvider();
        context.router?.navigate(`/${TMX_TOURNAMENTS}/${Date.now()}`);
      };
    } else {
      stopBtn.style.display = 'none';
      stopBtn.onclick = null;
    }
  }
}

/**
 * True when the active provider is one the current user doesn't directly
 * belong to — i.e. they reached it via super-admin impersonation or
 * provisioner-managed access. False (no X displayed) for the common case
 * of a user operating in one of their own associations.
 */
function isImpersonating(activeProviderId?: string): boolean {
  if (!activeProviderId) return false;
  const login = getLoginState();
  if (!login) return false;
  const associations = login.providerAssociations ?? [];
  return !associations.some((a) => a.providerId === activeProviderId);
}
