/**
 * Who may enter demo mode, and when the posture must be discarded.
 *
 * Split from `demoState` so `loginState` can import the eligibility check
 * without `demoState` needing to import `loginState` back.
 *
 * Deliberately NOT offered to an ordinary provider member on a live provider:
 * one stray click and they file a support ticket saying TMX is broken.
 *
 * ## Why "no provider" is the default-on case
 *
 * A session with no provider — no token and no impersonation — has nothing for
 * demo mode to misrepresent: no white label to contradict, no server-side
 * permission set for the overlay to shadow, and no support desk that will be
 * asked why TMX "broke". That session IS the demo, and it is the only audience
 * this drawer was ever built for.
 *
 * Gating it on `featureFlags.demoMode` made the drawer unreachable for exactly
 * that audience, because nothing in TMX ever writes that flag — no settings
 * control, no URL param, no provider default. The flag survives as the opt-in
 * for the *other* case: a super-admin demonstrating from inside a real,
 * provider-bearing session.
 */
import { getToken } from 'services/authentication/tokenManagement';
import { clearDemoOverlay as clearOverlay } from './demoState';
import { featureFlags } from 'config/featureFlags';
import { context } from 'services/context';

export { clearDemoOverlay } from './demoState';

export function isDemoEligible(): boolean {
  // Decode the raw token rather than reading the resolved login state: this
  // module is imported BY loginState, and reading it back would be a cycle.
  // It also keeps a future identity mask from hiding the menu item that turns
  // the mask off. `context.provider` is read for the same reason — it is the
  // impersonation slot, and `providerState` imports `loginState`.
  const raw = (() => {
    try {
      return getToken();
    } catch {
      return undefined;
    }
  })();

  // Anonymous AND unimpersonated — the local-only evaluation session. On by
  // default; the flag is not consulted because nothing can set it.
  if (!raw) return !context.provider;

  if (!featureFlags.get().demoMode) return false;
  try {
    const payload = JSON.parse(atob(raw.split('.')[1] ?? ''));
    return !!payload?.roles?.includes('superadmin');
  } catch {
    return false;
  }
}

/** Called on login and logout — a posture must never outlive an identity change. */
export function clearDemoOnIdentityChange(): void {
  clearOverlay();
}
