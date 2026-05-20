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
import { getLoginState } from 'services/authentication/loginState';
import { baseApi } from 'services/apis/baseApi';
import { context } from 'services/context';

import type { ProviderValue } from 'types/tmx';

import { TMX_TOURNAMENTS } from 'constants/tmxConstants';

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
      },
      () => {
        /* fetch failure — keep prior providerConfig (better than wiping) */
      },
    );
  }
}

async function fetchEffectiveConfig(providerId: string): Promise<any | undefined> {
  const response = await baseApi.get(`/provider/${providerId}/effective-config`);
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
    return persisted;
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
    if (provider?.organisationAbbreviation) {
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
