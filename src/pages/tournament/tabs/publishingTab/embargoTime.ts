import { venueParts, venueWallClockToMs } from 'functions/venueTimeFrame';
import { tools } from 'tods-competition-factory';

/**
 * An embargo instant → the date and time fields the modal edits, on the
 * **venue's** clock.
 *
 * An embargo is a tournament decision ("hold results until 18:00"), so 18:00
 * means 18:00 at the venue. Read on the operator's clock, a director travelling
 * would set an embargo that lifts at the wrong hour on site — and, because the
 * field round-trips, would silently rewrite the existing one just by opening
 * the modal. This and `venuePartsToGMT` must always move together for that
 * reason: they are one conversion in two directions.
 */
export function embargoToLocalParts(isoString?: string): { date: string; time: string } {
  if (!isoString) return { date: '', time: '' };
  const parts = venueParts(isoString);
  if (!parts) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/**
 * The inverse of `embargoToLocalParts` — a venue wall clock back to a UTC instant. `undefined` when it
 * cannot be read (an unreadable date or time, or a refused venue frame): it used to answer "now",
 * which set an embargo that had already lifted, silently.
 */
export function venuePartsToGMT(date: string, time12h: string): string | undefined {
  const militaryTime = tools.dateTime.convertTime(time12h, true) || time12h;
  const ms = venueWallClockToMs(date, militaryTime || '12:00');
  return ms === undefined ? undefined : new Date(ms).toISOString();
}
