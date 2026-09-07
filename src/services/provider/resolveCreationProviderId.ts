import type { LoginState, ProviderValue } from 'types/tmx';

/**
 * Resolve the provider that owns a newly-created tournament.
 *
 * `context.provider` is the source of truth after an explicit provider switch.
 * In particular, super-admin impersonation does not rewrite the provider fields
 * in the login JWT, so consulting only `LoginState.providerId` silently creates
 * a local-only tournament instead of sending it to the selected provider.
 */
export function resolveCreationProviderId(
  loginState: LoginState | undefined,
  activeProvider: ProviderValue | undefined,
): string | undefined {
  return activeProvider?.organisationId ?? loginState?.providerId ?? loginState?.provider?.organisationId;
}
