/**
 * Provider switcher menu.
 *
 * Two cohorts:
 *   - Super-admin: full "any provider in the system" selector via the
 *     existing selectProviderModal (the impersonation path; unchanged).
 *   - Any user with N>1 user_providers associations: pick from the
 *     providers they're associated with. Server persists the choice via
 *     PATCH /auth/me/last-selected-provider (handled inside
 *     setActiveProvider).
 *
 * Refreshes the tournaments table after a switch so the calendar reflects
 * the new context.provider.
 */
import { selectProviderModal } from 'components/modals/selectProviderModal';
import { exchangeForProviderSession } from 'services/authentication/providerSelection';
import { getLoginState, logIn } from 'services/authentication/loginState';
import { getToken } from 'services/authentication/tokenManagement';
import { context } from 'services/context';
import { tipster } from './tipster';
import { t } from 'i18n';
import {
  setActiveProvider,
  clearActiveProvider,
  getActiveProvider,
  getProviderAssociations,
  getProvisionerProviders,
} from 'services/provider/providerState';

import { SUPER_ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

import type { ProviderValue } from 'types/tmx';

type OpenProviderSwitcherParams = {
  target: HTMLElement;
};

/**
 * Switch the SESSION to another provider (CA, 2026-10-06): the server issues a session for it, and the token's
 * `providerId` claim — which the server enforces — moves with it. A super-admin's pick stays client-side
 * (impersonation): the server lets a super-admin act for any provider.
 */
function switchSessionProvider(
  provider: ProviderValue,
  isSuperAdmin: boolean,
  options?: { persistServer?: boolean },
): void {
  const token = getToken();
  if (isSuperAdmin || !token) {
    setActiveProvider(provider, options);
    refreshAfterSwitch();
    return;
  }
  exchangeForProviderSession(provider.organisationId, token).then((session) => {
    if (!session) return;
    // logIn re-resolves the active provider from the new token, wipes the previous provider's local copies and
    // reloads the tournaments list for the new one
    logIn({ data: session });
  });
}

function refreshAfterSwitch(): void {
  // Append a unique suffix so Navigo re-resolves the route even when
  // the user is already on /tournaments. Mirrors the pattern in logIn.
  context.router?.navigate(`/${TMX_TOURNAMENTS}/${Date.now()}`);
}

export function openProviderSwitcher({ target }: OpenProviderSwitcherParams): void {
  const current = getActiveProvider();
  const isSuperAdmin = !!getLoginState()?.roles?.includes(SUPER_ADMIN);
  const associations = getProviderAssociations();

  // For users with multiple associations, render the actual list of
  // providers they belong to. Currently-active one is marked with a check
  // and is a no-op on click.
  const associationItems = associations.map((assoc) => {
    const isActive = current?.organisationId === assoc.providerId;
    return {
      text: isActive ? `${assoc.organisationName} ✓` : assoc.organisationName,
      hide: false,
      onClick: () => {
        if (isActive) return;
        switchSessionProvider(
          {
            organisationId: assoc.providerId,
            organisationName: assoc.organisationName,
            organisationAbbreviation: assoc.organisationAbbreviation,
          } as ProviderValue,
          isSuperAdmin,
        );
      },
    };
  });

  // Provisioner-managed providers. These have no user_providers row, so the
  // server would reject persisting them as last-selected — set locally only
  // (persistServer: false). Deduped against direct associations.
  const associationIds = new Set(associations.map((assoc) => assoc.providerId));
  const provisionerItems = getProvisionerProviders()
    .filter((prov) => !associationIds.has(prov.providerId))
    .map((prov) => {
      const isActive = current?.organisationId === prov.providerId;
      return {
        text: isActive ? `${prov.organisationName} ✓` : prov.organisationName,
        hide: false,
        onClick: () => {
          if (isActive) return;
          switchSessionProvider(
            {
              organisationId: prov.providerId,
              organisationName: prov.organisationName,
              organisationAbbreviation: prov.organisationAbbreviation,
            } as ProviderValue,
            isSuperAdmin,
            { persistServer: false },
          );
        },
      };
    });

  // Super-admin keeps the "any provider in the system" path on top so
  // they can impersonate beyond their own associations.
  const superAdminItems = isSuperAdmin
    ? [
        {
          text: current?.organisationId ? t('providerSwitcher.switchProvider') : t('providerSwitcher.selectProvider'),
          onClick: () => {
            selectProviderModal({
              callback: (provider: ProviderValue) => {
                if (!provider?.organisationId) return;
                setActiveProvider(provider);
                refreshAfterSwitch();
              },
            });
          },
        },
      ]
    : [];

  const items = [
    ...superAdminItems,
    ...associationItems,
    ...provisionerItems,
    {
      text: t('providerSwitcher.clearImpersonation'),
      // Only super-admins get "Clear" — returning to "no impersonation"
      // is only meaningful for them. Regular multi-provider users always
      // need some active provider, so picking from their associations is
      // the way to switch.
      hide: !isSuperAdmin || !current?.organisationId,
      onClick: () => {
        clearActiveProvider();
        refreshAfterSwitch();
      },
    },
  ];

  tipster({
    target,
    title: current?.organisationName
      ? t('providerSwitcher.titleImpersonating', { name: current.organisationName })
      : t('providerSwitcher.title'),
    items,
  });
}
