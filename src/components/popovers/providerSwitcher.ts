/**
 * Provider switcher menu for super-admins.
 *
 * Anchored to a navbar element. Offers:
 *  - Switch provider...  (opens the existing selectProviderModal)
 *  - Clear impersonation (only when impersonating)
 *
 * Refreshes the tournaments table after a switch so the calendar reflects
 * the new context.provider.
 */
import { setActiveProvider, clearActiveProvider, getActiveProvider } from 'services/provider/providerState';
import { selectProviderModal } from 'components/modals/selectProviderModal';
import { context } from 'services/context';
import { tipster } from './tipster';
import { t } from 'i18n';

import { TMX_TOURNAMENTS } from 'constants/tmxConstants';

import type { ProviderValue } from 'types/tmx';

type OpenProviderSwitcherParams = {
  target: HTMLElement;
};

function refreshAfterSwitch(): void {
  // Append a unique suffix so Navigo re-resolves the route even when
  // the user is already on /tournaments. Mirrors the pattern in logIn.
  context.router?.navigate(`/${TMX_TOURNAMENTS}/${Date.now()}`);
}

export function openProviderSwitcher({ target }: OpenProviderSwitcherParams): void {
  const current = getActiveProvider();
  const impersonating = !!current?.organisationId;

  const items = [
    {
      text: impersonating ? t('providerSwitcher.switchProvider') : t('providerSwitcher.selectProvider'),
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
    {
      text: t('providerSwitcher.clearImpersonation'),
      hide: !impersonating,
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
