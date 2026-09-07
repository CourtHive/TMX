import type { LoginState, ProviderValue } from 'types/tmx';

/**
 * Resolve the provider that owns a newly-created tournament.
 *
 * `context.provider` is the source of truth after an explicit provider switch.
 * In particular, super-admin impersonation does not rewrite the provider fields
 * in the login JWT, so consulting only `LoginState.providerId` silently creates
 * a local-only tournament instead of sending it to the selected provider.
 *
 * The precedence matches what the rest of the client already does inline —
 * `context.provider || state?.provider` in the dashboard, publishing and
 * settings tabs, and `context.provider ?? getLoginState()?.provider` in
 * `homeNavigation`. This is the creation path's copy of that rule, with the
 * flat `providerId` claim kept as the middle rung because a provider-scoped
 * user's JWT carries it without a nested `provider` object.
 *
 * Returns `undefined` when no provider is active: the caller then keeps the
 * tournament local rather than guessing an owner.
 */
export function resolveCreationProviderId(
  loginState: LoginState | undefined,
  activeProvider: ProviderValue | undefined,
): string | undefined {
  return activeProvider?.organisationId ?? loginState?.providerId ?? loginState?.provider?.organisationId;
}
