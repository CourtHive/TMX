import { setCompetitionClock } from 'services/clock/competitionClock';
import { embargoToLocalParts, venuePartsToGMT } from './embargoTime';
import { tournamentEngine } from 'services/factory/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { resolvePublishState } from './publishingData';
import { mocksEngine } from 'tods-competition-factory';

// Clock plan slice 0-d.4. TZ=UTC runs this suite, so every frame below names a zone that is not UTC.
const TOKYO = 'Asia/Tokyo';
const DAY = '2026-05-18';
const SIX_PM = '18:00';

function seed({ localTimeZone, venueZones = [] }: { localTimeZone?: string; venueZones?: string[] }) {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 2 }] });
  tournamentRecord.venues = venueZones.map((timeZone, index) => ({
    venueId: `venue-${index}`,
    venueName: `Venue ${index}`,
    addresses: [{ timeZone }],
  }));
  if (localTimeZone) tournamentRecord.localTimeZone = localTimeZone;
  tournamentEngine.setState(tournamentRecord);
}

describe('embargo time, on the venue clock', () => {
  it('reads a venue wall clock back to its instant, and round-trips', () => {
    seed({ localTimeZone: TOKYO });
    const iso = venuePartsToGMT(DAY, SIX_PM);
    expect(iso).toBe('2026-05-18T09:00:00.000Z');
    expect(embargoToLocalParts(iso)).toEqual({ date: DAY, time: SIX_PM });
  });

  it('refuses under a refused venue frame, where it used to answer "now"', () => {
    seed({ venueZones: [TOKYO, 'America/New_York'] });
    expect(venuePartsToGMT(DAY, SIX_PM)).toBeUndefined();
  });

  it('refuses an unreadable date', () => {
    seed({ localTimeZone: TOKYO });
    expect(venuePartsToGMT('2026-02-30', SIX_PM)).toBeUndefined();
  });
});

describe('the publish state follows the competition clock', () => {
  afterEach(() => {
    setCompetitionClock();
  });

  it('with no usable competition instant an embargo is never read as lifted', () => {
    const lapsed = new Date(Date.now() - 60 * 60_000).toISOString(); // lifted an hour ago on the device
    setCompetitionClock({ nowMs: () => Number.NaN });
    expect(resolvePublishState(true, lapsed)).toBe('embargoed');
  });

  it('an embargo lifts when the COMPETITION clock passes it, not the device clock', () => {
    const embargo = new Date(Date.now() + 60 * 60_000).toISOString(); // an hour ahead of the device
    expect(resolvePublishState(true, embargo)).toBe('embargoed');
    setCompetitionClock({ nowMs: () => Date.parse(embargo) + 1 });
    expect(resolvePublishState(true, embargo)).toBe('live');
  });
});
