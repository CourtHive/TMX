/**
 * Everything in the chrome that a demo posture governs, re-applied in one place.
 *
 * Called at every point the overlay is mutated, so it is the de facto
 * "posture changed" hook. Keep it that way: splitting the nav back out into its
 * own call is how the nav went stale in the first place.
 *
 * ## Visual signals
 *
 * Demo mode must be visually unmistakable — a posture that silently persists
 * looks like a bug report waiting to happen. The navbar badge and active clock bar colors
 * identify the posture without taking vertical space above the navigation.
 * The badge uses `--tmx-fill-warning`, which is defined with the same value in light
 * and dark, so no per-theme override is needed.
 *
 * ## Navigation
 *
 * `applyTabCapabilityVisibility` was previously reached only from
 * `highlightTab` and `tmxNavigation` — i.e. on a tab render. A posture chosen in
 * the drawer renders no tab, so the icons kept the PREVIOUS posture's visibility
 * until the user happened to navigate. That failed in both directions: a
 * restricted posture still offered icons the router then bounced them off, and
 * exiting demo mode left the restricted set on screen with no icon to click to
 * trigger the render that would have restored them.
 *
 * `reapplyTabCapability` also leaves a section the new posture denies. The route
 * guard cannot help there: no route changed, so it never runs.
 */
import { reapplyTabCapability } from 'navigation';
import { isDemoActive } from './demoState';
import { t } from 'i18n';

const BADGE_ID = 'demoBadge';

export function renderDemoAffordance(): void {
  if (typeof document === 'undefined') return;

  const active = isDemoActive();
  document.documentElement.dataset.tmxDemo = active ? 'true' : '';

  // Before the badge: the nav rail is the signal the operator reads first, and a
  // posture that has not reached it is a posture the user can still navigate around. This also
  // leaves a section the new posture denies — choosing "read only" while sitting on Events must
  // not leave Events on screen with only its icon gone.
  reapplyTabCapability();

  // ── navbar badge ──
  let badge = document.getElementById(BADGE_ID);
  if (!active) {
    badge?.remove();
  } else {
    if (!badge) {
      badge = document.createElement('span');
      badge.id = BADGE_ID;
      badge.className = 'tmx-demo-navbar-badge';
      document.getElementById('provider')?.parentElement?.appendChild(badge);
    }
    badge.textContent = t('demoMode.badgeLabel');
  }
}
