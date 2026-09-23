import { TournamentSearchHit } from 'services/apis/searchTournaments';

/**
 * Translate a SEARCH hit into the parts of a tournament record that the shared card mapper reads.
 *
 * A hit is a row of the DISCOVERY projection, not a TODS record: flat, and deliberately narrower
 * than what the calendar returns. Rather than teach the card a second shape, this rebuilds the
 * small part of a record `mapTournamentToCardData` actually consumes — venue address, entry fees,
 * registration dates, tier — so one mapper serves both sources.
 *
 * Kept SEPARATE from `searchRowToTournamentRow` on purpose: importing the card mapper pulls in
 * `courthive-components`, which touches `document` at module load and so cannot be imported by a
 * node-environment unit test. Everything worth asserting about the translation lives here, where
 * it can be tested against the real implementation rather than against a stub of it.
 *
 * What a hit CANNOT supply, and what that costs:
 *   - no participant count (the projection does not carry one) — the card omits the pill
 *   - no tournament image or court SVG — the card falls back to its default
 * Both are absences, not wrong values. A search result showing a stale count would be worse.
 */

/** `feeMin` / `feeMax` arrive as strings from Postgres numerics; only a real number is a fee. */
function toAmount(value: string | null): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
}

interface AdaptedFee {
  amount: number;
  currencyCode?: string;
  unit?: 'MINOR' | 'MAJOR';
}

/**
 * The fee range, as the one or two fees it takes to express it.
 *
 * `unit` is carried through rather than assumed: a fee whose unit is unknown renders as unknown,
 * because assuming MAJOR rendered minor-unit records 100x high once already (`feeFormatter`).
 */
function entryFees(hit: TournamentSearchHit): AdaptedFee[] {
  const currencyCode = hit.feeCurrency ?? undefined;
  const unit = (hit.feeUnit as 'MINOR' | 'MAJOR' | null) ?? undefined;
  const min = toAmount(hit.feeMin);
  const max = toAmount(hit.feeMax);
  const fees: AdaptedFee[] = [];
  if (min !== undefined) fees.push({ amount: min, currencyCode, unit });
  if (max !== undefined && max !== min) fees.push({ amount: max, currencyCode, unit });
  return fees;
}

/** Only build a venue when there is something to put in it — an empty one formats as nothing. */
function venues(hit: TournamentSearchHit): any[] {
  const { venueName, city, state, countryCode } = hit;
  if (!venueName && !city && !state && !countryCode) return [];
  const addresses = city || state || countryCode ? [{ city, state, countryCode }] : undefined;
  return [{ venueName: venueName ?? undefined, addresses }];
}

export function searchHitToRecord(hit: TournamentSearchHit): any {
  const fees = entryFees(hit);
  return {
    tournamentId: hit.tournamentId,
    tournamentName: hit.tournamentName,
    startDate: hit.startDate ?? undefined,
    endDate: hit.endDate ?? undefined,
    // The projection records WHEN it was cancelled; the card asks WHETHER it is.
    tournamentStatus: hit.cancelledAt ? 'CANCELLED' : undefined,
    venues: venues(hit),
    registrationProfile: {
      entriesOpen: hit.entriesOpen ?? undefined,
      entriesClose: hit.entriesClose ?? undefined,
      entryFees: fees.length ? fees : undefined,
    },
    tournamentTier: hit.levelSystem && hit.levelValue ? { system: hit.levelSystem, value: hit.levelValue } : undefined,
  };
}
