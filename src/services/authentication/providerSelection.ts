/**
 * THE PROVIDER A SESSION ACTS FOR (Mentat/planning/MULTI_PROVIDER_CONTEXT_COMPLETION.md).
 *
 * A user associated with more than one provider chooses one at login, and the server issues the session for
 * it; switching provider is the same exchange made with the current session. The token's `providerId` claim
 * is then the provider the session acts for, and the server refuses work on any other (CA, 2026-10-06).
 */
import type { ChoosableProvider } from 'components/modals/chooseProviderModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { selectProvider } from './authApi';
import { t } from 'i18n';

type SessionData = { token: string; refreshToken?: string };

/** What a multi-provider login answers instead of a session. */
export type ProviderSelectionResponse = {
  providerSelectionRequired: true;
  lastSelectedProviderId?: string | null;
  providers: ChoosableProvider[];
  selectionToken: string;
};

export function isProviderSelectionResponse(data: any): data is ProviderSelectionResponse {
  return data?.providerSelectionRequired === true && typeof data?.selectionToken === 'string';
}

/**
 * Ask which provider to work for, exchange `bearer` for that provider's session, and hand it to `onSession`
 * (which is `logIn`). `bearer` is the selection token, or a session token that has not chosen yet.
 */
export function promptProviderSelection({
  lastSelectedProviderId,
  onSignOut,
  onSession,
  providers,
  bearer,
}: {
  lastSelectedProviderId?: string | null;
  onSession: (data: SessionData) => void;
  providers: ChoosableProvider[];
  onSignOut: () => void;
  bearer: string;
}): void {
  // Loaded on demand: the modal pulls in courthive-components, whose bundle touches `document` at import, and
  // loginState (which imports this) is reached by unit tests that run in node.
  import('components/modals/chooseProviderModal')
    .then(({ chooseProviderModal }) =>
      chooseProviderModal({
        lastSelectedProviderId,
        providers,
        onSignOut,
        onChoose: (providerId) => {
          exchangeForProviderSession(providerId, bearer).then((data) => {
            if (data) onSession(data);
            else onSignOut();
          });
        },
      }),
    )
    // without the picker there is no way to choose, and no session without a choice
    .catch(() => onSignOut());
}

/** The session for `providerId`, from a selection token or the current session; undefined when refused. */
export async function exchangeForProviderSession(providerId: string, bearer: string): Promise<SessionData | undefined> {
  const res: any = await selectProvider(providerId, bearer).catch(() => undefined);
  const data = res?.data;
  if (data?.token) return data;
  tmxToast({ intent: 'is-danger', message: t('modals.chooseProvider.failed') });
  return undefined;
}
