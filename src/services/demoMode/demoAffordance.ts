/**
 * Demo mode must be visually unmistakable — a posture that silently persists
 * looks like a bug report waiting to happen.
 *
 * Two signals, because either alone can be missed on a projector: a navbar badge
 * and a non-dismissible banner. Both use `--tmx-fill-warning`, which is defined
 * with the same value in light and dark, so no per-theme override is needed.
 */
import { isDemoActive, getDemoOverlay } from './demoState';
import { t } from 'i18n';

const BADGE_ID = 'demoBadge';
const BANNER_ID = 'demoBanner';

function deniedCount(): number {
  return Object.keys(getDemoOverlay()?.permissions ?? {}).length;
}

export function renderDemoAffordance(): void {
  if (typeof document === 'undefined') return;

  const active = isDemoActive();
  document.documentElement.dataset.tmxDemo = active ? 'true' : '';

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

  // ── banner ──
  let banner = document.getElementById(BANNER_ID);
  if (!active) {
    banner?.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'tmx-demo-banner';
    document.body.prepend(banner);
  }
  const preset = getDemoOverlay()?.preset ?? 'custom';
  banner.textContent = t('demoMode.bannerText', {
    preset: t(`demoMode.presets.${preset}`, { defaultValue: preset }),
    count: deniedCount(),
  });
}
