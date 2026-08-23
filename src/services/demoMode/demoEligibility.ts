/**
 * Who may enter demo mode, and when the posture must be discarded.
 *
 * Split from `demoState` so `loginState` can import the eligibility check
 * without `demoState` needing to import `loginState` back.
 *
 * Deliberately NOT offered to an ordinary provider member on a live provider:
 * one stray click and they file a support ticket saying TMX is broken. Requires
 * the beta flag AND either an anonymous session or a super-admin.
 */
import { clearDemoOverlay as clearOverlay } from './demoState';
import { getToken } from 'services/authentication/tokenManagement';
import { featureFlags } from 'config/featureFlags';

export { clearDemoOverlay } from './demoState';

export function isDemoEligible(): boolean {
  if (!featureFlags.get().demoMode) return false;
  try {
    // Decode the raw token rather than reading the resolved login state: this
    // module is imported BY loginState, and reading it back would be a cycle.
    // It also keeps a future identity mask from hiding the menu item that turns
    // the mask off.
    const raw = getToken();
    if (!raw) return true; // anonymous / local-only session
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
