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
import { getLoginState } from 'services/authentication/loginState';
import { ensurePdfFontReady } from 'services/pdf/pdfFont';
import { setupChatIndicator } from 'navigation';
import { providerConfig } from 'config/providerConfig';
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
        // Guard against a stale fetch resolving after the user switched
        // providers again — applying it would repaint the wrong provider's
        // branding/permissions.
        if (context.provider?.organisationId !== provider.organisationId) return;
        // Reset first so the new provider fully replaces the prior one:
        // providerConfig.set() merges, and a provider that omits a branding
        // slice would otherwise inherit the previous provider's branding
        // (the "switch to BOBOCA still shows INTENNSE" bug). reset() also
        // clears stale permissions from the provider we switched away from.
        providerConfig.reset();
        if (effective) providerConfig.set(effective);
        // canUseChat may differ for the impersonated provider — re-evaluate the
        // chat indicator so a super-admin impersonating a chat-enabled provider
        // sees it (and vice-versa).
        setupChatIndicator();
        // reset()/set() repaint the navbar via applyBranding →
        // updateNavbarBranding, which falls back to the active provider's
        // abbreviation when the provider defines no navbar logo/appName — so a
        // brandless provider still shows its own identity, not 'TMX'.
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
  // Drop the impersonated provider's config from the singleton so its branding
  // can't linger after stopping impersonation. The next getLoginState() re-
  // applies the JWT user's own home config (context.provider is now cleared,
  // so applyJwtProviderConfig no longer yields to an impersonation override).
  providerConfig.reset();
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
 * The active provider at boot (Mentat/planning/MULTI_PROVIDER_CONTEXT_COMPLETION.md).
 *
 * For everyone but a super-admin it is the provider the SESSION was issued for: the token's `providerId`
 * claim, chosen at login by a user with several providers (CA, 2026-10-06) and enforced by the server. There
 * is no fallback to a home provider or to the first association: an account that has not chosen gets the
 * provider picker at login instead (`providerSelection.ts`), never a provider picked for it.
 *
 * A super-admin's pick is client-side impersonation, persisted in localStorage; honoured only for a
 * super-admin (`canUsePersistedProvider`), otherwise cleared as a stale handoff from a previous user.
 */
export function resolveInitialProvider(): ProviderValue | undefined {
  const login = getLoginState();
  if (!login) return undefined;
  const associations = login.providerAssociations ?? [];
  const isSuperAdmin = !!login.roles?.includes(SUPER_ADMIN);

  const persisted = readPersistedProvider();
  if (persisted?.organisationId && persisted.organisationName && persisted.organisationAbbreviation) {
    if (isSuperAdmin && canUsePersistedProvider(login, persisted.organisationId, associations)) return persisted;
    try {
      globalThis.localStorage?.removeItem(IMPERSONATED_PROVIDER_KEY);
    } catch {
      /* non-fatal */
    }
  }

  const providerId = login.providerId;
  if (!providerId) return undefined;
  const association = associations.find((a) => a.providerId === providerId);
  if (association) {
    return {
      organisationId: association.providerId,
      organisationName: association.organisationName,
      organisationAbbreviation: association.organisationAbbreviation,
    } as ProviderValue;
  }
  const managed = (login.provisionerProviders ?? []).find((p: any) => p.providerId === providerId);
  if (managed) {
    return {
      organisationId: managed.providerId,
      organisationName: managed.organisationName,
      organisationAbbreviation: managed.organisationAbbreviation,
    } as ProviderValue;
  }
  // a single-provider or legacy session whose token carries the provider object itself
  return (login.provider as ProviderValue | undefined) ?? undefined;
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
