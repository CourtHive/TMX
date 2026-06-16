import { isValidTimeZone } from 'functions/getSupportedTimeZones';

/**
 * Best-effort detection of the host machine's IANA time zone via the
 * platform's `Intl` API. Used as a UX nudge — never silently applied;
 * the TD always confirms (or overrides) via the Edit Dates modal.
 *
 * Returns null when the platform doesn't expose a usable zone (some
 * embedded WebViews, locked-down kiosk browsers) or when the returned
 * value isn't one we recognise in our supported-zones list — better to
 * fall back to a generic "Set time zone" prompt than to suggest a zone
 * the picker can't ratify.
 */
export function getDetectedTimeZone(): string | null {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof detected !== 'string' || detected.length === 0) return null;
    return isValidTimeZone(detected) ? detected : null;
  } catch {
    return null;
  }
}
