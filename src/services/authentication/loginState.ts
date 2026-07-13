import { getToken, removeToken, setToken, getRefreshToken, setRefreshToken, removeRefreshToken } from './tokenManagement';
import { renderSettingsTab } from 'pages/tournament/tabs/settingsTab/renderSettingsTab';
import { renderOverview } from 'pages/tournament/tabs/overviewTab/renderOverview';
import { initProviderSwitcher } from 'services/provider/initProviderSwitcher';
import { notifySessionRecovered } from 'services/session/sessionGuard';
import { setupChatIndicator } from 'navigation';
import { resetActivityTimer } from 'services/staleness/stalenessGuard';
import { clearUserContext, fetchUserContext } from './getUserContext';
import { clearActiveProvider } from 'services/provider/providerState';
import { validateToken } from 'services/authentication/validateToken';
import { disconnectSocket } from 'services/messaging/socketIo';
import { refreshAccessToken } from 'services/apis/baseApi';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { isActiveProviderAdmin } from './isProviderAdmin';
import { loginModal } from 'components/modals/loginModal';
import { ensurePdfFontReady } from 'services/pdf/pdfFont';
import { getLoginColor } from 'functions/getLoginColor';
import { providerConfig } from 'config/providerConfig';
import { tipster } from 'components/popovers/tipster';
import { tmx2db } from 'services/storage/tmx2db';
import { revokeRefreshToken } from './authApi';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';

// types
import type { LoginState } from 'types/tmx';

// constants
import { SUPER_ADMIN, TMX_TOURNAMENTS, NONE } from 'constants/tmxConstants';

export function styleLogin(valid: LoginState | undefined | false): void {
  const el = document.getElementById('login');
  if (!el) return;
  el.style.color = getLoginColor({
    valid: !!valid,
    impersonating: !!context?.provider,
    isSuperAdmin: !!(valid && valid.roles?.includes(SUPER_ADMIN)),
  });
}

/**
 * Apply the JWT-baked effective provider config, UNLESS the session is
 * actively impersonating a *different* provider. Super-admin impersonation
 * (setActiveProvider → GET /provider/:id/effective-config) applies the
 * impersonated provider's effective config out-of-band. Because getLoginState()
 * runs on many code paths (styleLogin, the provider switcher, isProviderAdmin,
 * route renders), re-applying the token's home-provider config every time would
 * clobber the impersonated branding/permissions and snap the navbar back to the
 * JWT provider — the "reverts to INTENNSE" bug. Skip the apply while an
 * out-of-band impersonation is in effect; clearActiveProvider() drops the
 * override and re-applies this on the next call.
 */
function applyJwtProviderConfig(valid: LoginState): void {
  const activeId = context.provider?.organisationId;
  const impersonatingDifferent = !!activeId && activeId !== valid.providerId;
  if (valid.activeProviderConfig && !impersonatingDifferent) {
    providerConfig.set(valid.activeProviderConfig);
  }
}

export function getLoginState(): LoginState | undefined {
  const token = getToken();
  const valid = validateToken(token);
  if (valid) {
    styleLogin(valid);
    // Apply effective provider config from the JWT on each load. Boot path
    // (existing valid token + page reload) reaches here without hitting
    // logIn(), so the apply must live here too. Default-permissive when
    // the field is absent (older token / no provider). Yields to an active
    // impersonation override — see applyJwtProviderConfig.
    applyJwtProviderConfig(valid);
  }
  return valid;
}

export function logOut(): void {
  // Best-effort server-side revocation of the refresh token so a leaked copy
  // can't be replayed after logout. Fire-and-forget; never blocks local logout.
  const refreshToken = getRefreshToken();
  if (refreshToken) revokeRefreshToken(refreshToken).catch(() => undefined);
  removeToken();
  removeRefreshToken();
  clearUserContext();
  disconnectSocket();
  tournamentEngine.reset();
  clearActiveProvider();
  providerConfig.reset();
  // Wipe provider-bound tournaments from IndexedDB so user A's cached
  // records can't surface to user B on a shared browser via the local-DB
  // fallback in createTournamentsTable. Demo/scratchpad tournaments (no
  // parentOrganisation) are preserved — per the explicit requirement in
  // Mentat/planning/USER_TOURNAMENT_ACCESS_MODEL.md PR 11.
  void tmx2db.deleteProviderBoundTournaments().catch((err) => {
    console.error('[auth] failed to clear provider-bound tournaments on logout', err);
  });
  // Stop the staleness timer so a leftover scheduled check can't fire after
  // logout and toast a "Missing tournamentRecord" error for a local-only
  // tournament that was never on the server.
  resetActivityTimer();
  context.matchUpFilters = {};
  context.router?.navigate(`/${TMX_TOURNAMENTS}/logout`);
  styleLogin(false);
}

export function logIn({
  data,
  callback,
}: {
  data: { token: string; refreshToken?: string };
  callback?: () => void;
}): void {
  const valid = validateToken(data.token);
  const tournamentInState = tournamentEngine.q.tournament()?.tournamentId;
  if (valid) {
    setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    clearUserContext();
    // Wipe any prior session's impersonated-provider context so the new
    // user doesn't inherit it. Without this, a super-admin's impersonation
    // pick (e.g. rooby@courthive.com viewing TYPTI Global) survives in
    // localStorage and resolveInitialProvider() honors it as Step 1 for the
    // *next* user to log in on the same browser — they'd then see the
    // impersonated provider's calendar instead of their own. logOut()
    // already clears this; logIn must too because users often arrive
    // here from a tab close / browser reopen without an intervening
    // explicit logout. (2026-06-02: charles@intennse.com saw a TYPTI
    // tournament because of this.) The provider switcher below repopulates
    // from the new user's associations.
    clearActiveProvider();
    // Same selective IDB clear as logOut(): users often arrive here from a
    // tab close / browser reopen without an intervening explicit logout, so
    // a previous user's provider-bound tournaments may still be in IDB.
    // Demo/scratchpad tournaments are preserved.
    void tmx2db.deleteProviderBoundTournaments().catch((err) => {
      console.error('[auth] failed to clear provider-bound tournaments on login', err);
    });
    // Fire-and-forget: fetch the multi-provider user context from the server.
    // The context will be available by the time the user interacts with the
    // tournaments table or any provider-scoped UI element.
    fetchUserContext();
    if (valid.activeProviderConfig) providerConfig.set(valid.activeProviderConfig);
    // Re-resolve the PDF font now that the provider's defaultPdfFont is known.
    void ensurePdfFontReady();
    tmxToast({ intent: 'is-success', message: t('toasts.loggedIn') });
    disconnectSocket();
    if (!tournamentInState) tournamentEngine.reset();
    styleLogin(valid);
    initProviderSwitcher();
    // Reveal the chat indicator now that a server session exists (the nav may
    // have first rendered logged-out / with an expired token).
    setupChatIndicator();
    // Clear any session-expiry banner and replay edits that were preserved
    // while the session was lost. No-op on a first/fresh login (nothing
    // pending, no banner) — the guard's own silent-refresh path covers the
    // automatic case.
    notifySessionRecovered();
    if (isFunction(callback)) {
      callback();
    } else if (!tournamentInState) {
      context.router?.navigate(`/${TMX_TOURNAMENTS}/${valid.provider?.organisationAbbreviation ?? Date.now()}`);
    }

    if (tournamentInState) {
      reRenderActiveTab();
    }
  }
}

// Coalesce concurrent boot-time refresh attempts (getLoginState can be called
// many times during routing) so the refresh token rotates only once.
let silentRefreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the stored refresh token for a fresh access token and re-apply the
 * session WITHOUT navigating or tearing down the socket. Used on boot (and any
 * point a still-valid refresh token outlives an expired access token) so a
 * returning user stays logged in instead of being bounced to a login screen.
 * On failure, logs out cleanly.
 */
export function attemptSilentRefresh(): Promise<boolean> {
  if (!silentRefreshInFlight) {
    silentRefreshInFlight = doSilentRefresh().finally(() => {
      silentRefreshInFlight = null;
    });
  }
  return silentRefreshInFlight;
}

async function doSilentRefresh(): Promise<boolean> {
  const newToken = await refreshAccessToken();
  if (!newToken) {
    logOut();
    return false;
  }
  const valid = validateToken(newToken);
  if (!valid) {
    logOut();
    return false;
  }
  clearUserContext();
  fetchUserContext();
  // Yields to an active impersonation override — see applyJwtProviderConfig.
  applyJwtProviderConfig(valid);
  styleLogin(valid);
  initProviderSwitcher();
  // Boot-time nav render ran while the access token was still expired (getLoginState
  // returned undefined), so the chat indicator was hidden. Re-evaluate now that the
  // refreshed token makes the session valid.
  setupChatIndicator();
  return true;
}

function reRenderActiveTab(): void {
  const overviewTab = document.getElementById('o-tab');
  const settingsTab = document.getElementById('c-tab');

  if (overviewTab && overviewTab.style.display !== NONE) {
    renderOverview();
  } else if (settingsTab && settingsTab.style.display !== NONE) {
    renderSettingsTab();
  }
}

export function cancelImpersonation(): void {
  clearActiveProvider();
  // Re-apply the JWT user's home effective config when stopping impersonation.
  // For full correctness on impersonation switch (not stop) the provider
  // switcher fetches GET /provider/:id/effective-config — see
  // initProviderSwitcher.ts.
  const valid = getLoginState();
  if (valid?.activeProviderConfig) providerConfig.set(valid.activeProviderConfig);
  else providerConfig.reset();
  // The home provider's canUseChat may differ from the impersonated one — re-evaluate.
  setupChatIndicator();
  context.router?.navigate(`/${TMX_TOURNAMENTS}/superadmin`);
}

export function initLoginToggle(id: string): void {
  const el = document.getElementById(id);

  if (el) {
    el.addEventListener('click', () => {
      const loggedIn = getLoginState();
      const superAdmin = loggedIn?.roles?.includes(SUPER_ADMIN);
      const impersonating = context?.provider;

      const items = [
        {
          onClick: () => tmxToast({ message: 'TBD: Registration Modal' }),
          text: t('loginMenu.register'),
          hide: !!loggedIn,
        },
        {
          onClick: () => loginModal(),
          hide: !!loggedIn,
          text: t('loginMenu.logIn'),
        },
        {
          style: 'text-decoration: line-through;',
          hide: !superAdmin || !impersonating,
          onClick: cancelImpersonation,
          text: t('loginMenu.impersonate'),
        },
        {
          text: t('loginMenu.admin'),
          hide: !isActiveProviderAdmin(),
          onClick: () => context.router?.navigate('/admin'),
        },
        {
          text: t('loginMenu.logOut'),
          hide: !loggedIn,
          onClick: logOut,
        },
      ];

      tipster({ target: el, title: t('loginMenu.authorization'), items });
    });
  }
}
