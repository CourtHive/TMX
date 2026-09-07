import type { LoginState, ProviderValue } from 'types/tmx';

/**
 * Resolve the provider the UI should treat as active.
 *
 * An explicit provider switch wins over the login JWT, because super-admin
 * impersonation sets `context.provider` without rewriting the token — the same
 * asymmetry that made tournament creation silently local-only before #1420.
 *
 * This is the object form. It was inlined at five call sites in three shapes
 * (`context.provider || state?.provider` in the dashboard, publishing and
 * settings tabs; `context.provider ?? getLoginState()?.provider` twice in
 * `homeNavigation`), which is how a rule drifts: each copy is correct until one
 * of them isn't.
 *
 * **Not** the same as `resolveCreationProviderId`, and the difference is
 * deliberate rather than an oversight. That helper answers "which provider
 * should own a tournament being created" and consults the flat `providerId`
 * claim *between* the two rungs here, so it is not this function followed by
 * `.organisationId`. Collapsing them would silently reorder the JWT rungs for
 * any token whose flat claim disagrees with its nested provider.
 */
export function resolveActiveProvider(
  loginState: LoginState | undefined,
  activeProvider: ProviderValue | undefined,
): ProviderValue | undefined {
  return activeProvider ?? loginState?.provider;
}
