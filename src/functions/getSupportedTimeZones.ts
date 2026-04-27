/**
 * Returns the list of IANA time-zone names supported by the current JS
 * runtime, sorted alphabetically. Used by the edit-tournament drawer's
 * typeahead and anywhere else that needs to offer a zone picker.
 *
 * Modern engines support `Intl.supportedValuesOf('timeZone')` (Chrome
 * 99+, Firefox 93+, Safari 15.4+, Node 18+); older runtimes fall back
 * to a minimal curated list so the picker still renders. Either way,
 * `isValidTimeZone()` is the authoritative validator — the picker list
 * is a convenience, not a whitelist.
 */

const FALLBACK_ZONES = Object.freeze([
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'America/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Fiji',
]);

export function getSupportedTimeZones(): string[] {
  // `Intl.supportedValuesOf` is a standards method but is optional on
  // older runtimes — guard and fall back rather than throw. When the
  // list is available we still prepend `UTC`: `Intl.DateTimeFormat`
  // accepts it universally but the `supportedValuesOf('timeZone')`
  // output typically omits it (the list is named IANA cities only).
  const intlAny = Intl as any;
  if (typeof intlAny?.supportedValuesOf === 'function') {
    try {
      const zones = intlAny.supportedValuesOf('timeZone');
      if (Array.isArray(zones) && zones.length) {
        const merged = zones.includes('UTC') ? [...zones] : ['UTC', ...zones];
        return merged.sort((a: string, b: string) => a.localeCompare(b));
      }
    } catch {
      // fall through to the curated list
    }
  }
  return [...FALLBACK_ZONES].sort((a, b) => a.localeCompare(b));
}

/**
 * True when `timeZone` is a non-empty string accepted by
 * `Intl.DateTimeFormat`. Treats falsy / non-string input as invalid.
 */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timeZone.trim() });
    return true;
  } catch {
    return false;
  }
}
