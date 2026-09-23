import { describe, expect, it } from 'vitest';

import { searchHitToRecord } from './searchHitToRecord';
import { TournamentSearchHit } from 'services/apis/searchTournaments';

/**
 * A search hit is the discovery projection's flat row; the card expects a record. These tests pin
 * the translation at the points where getting it wrong would show the user something FALSE rather
 * than something missing — a fee rendered 100x high, a cancelled tournament rendered as upcoming,
 * a location invented out of empty fields.
 *
 * The step AFTER this one — the record through `mapTournamentToCardData` and onto a card — needs a
 * DOM, and stubbing that mapper here would only test the stub. Journey 128 covers it in a browser.
 */

const TOURNAMENT_ID = 't-1';
const TOURNAMENT_NAME = 'Riverside Open';
const START_DATE = '2027-05-01';
const END_DATE = '2027-05-03';

const hit = (over: Partial<TournamentSearchHit> = {}): TournamentSearchHit => ({
  tournamentId: TOURNAMENT_ID,
  tournamentName: TOURNAMENT_NAME,
  providerId: 'p-1',
  startDate: START_DATE,
  endDate: END_DATE,
  venueName: null,
  city: null,
  state: null,
  countryCode: null,
  levelSystem: null,
  levelValue: null,
  entriesOpen: null,
  entriesClose: null,
  feeMin: null,
  feeMax: null,
  feeCurrency: null,
  feeUnit: null,
  eventCount: 0,
  cancelledAt: null,
  ...over,
});

describe('searchHitToRecord', () => {
  it('carries the calendar day through as a day, never as an instant', () => {
    const record = searchHitToRecord(hit({ startDate: START_DATE, endDate: END_DATE }));
    expect(record.startDate).toBe(START_DATE);
    expect(record.endDate).toBe(END_DATE);
  });

  it('turns a cancellation TIMESTAMP into the status the card asks about', () => {
    expect(searchHitToRecord(hit({ cancelledAt: '2027-02-01T00:00:00Z' })).tournamentStatus).toBe('CANCELLED');
    expect(searchHitToRecord(hit()).tournamentStatus).toBeUndefined();
  });

  it('builds no venue at all when there is nothing to put in it', () => {
    expect(searchHitToRecord(hit()).venues).toEqual([]);
  });

  it('keeps a venue name even when the address is empty', () => {
    const record = searchHitToRecord(hit({ venueName: 'Center Court' }));
    expect(record.venues).toEqual([{ venueName: 'Center Court', addresses: undefined }]);
  });

  it('carries the fee UNIT, because assuming one renders minor-unit fees 100x high', () => {
    const record = searchHitToRecord(hit({ feeMin: '60', feeCurrency: 'USD', feeUnit: 'MINOR' }));
    expect(record.registrationProfile.entryFees).toEqual([{ amount: 60, currencyCode: 'USD', unit: 'MINOR' }]);
  });

  it('expresses a range as two fees and a single price as one', () => {
    const range = searchHitToRecord(hit({ feeMin: '20', feeMax: '45', feeCurrency: 'USD', feeUnit: 'MAJOR' }));
    expect(range.registrationProfile.entryFees).toHaveLength(2);
    const flat = searchHitToRecord(hit({ feeMin: '20', feeMax: '20', feeCurrency: 'USD', feeUnit: 'MAJOR' }));
    expect(flat.registrationProfile.entryFees).toHaveLength(1);
  });

  it('treats an absent fee as absent rather than as zero', () => {
    expect(searchHitToRecord(hit()).registrationProfile.entryFees).toBeUndefined();
    expect(
      searchHitToRecord(hit({ feeMin: '0', feeCurrency: 'USD', feeUnit: 'MAJOR' })).registrationProfile.entryFees,
    ).toEqual([{ amount: 0, currencyCode: 'USD', unit: 'MAJOR' }]);
  });

  it('only claims a tier when both halves of it are present', () => {
    expect(searchHitToRecord(hit({ levelSystem: 'USTA', levelValue: 'Level 3' })).tournamentTier).toEqual({
      system: 'USTA',
      value: 'Level 3',
    });
    expect(searchHitToRecord(hit({ levelSystem: 'USTA' })).tournamentTier).toBeUndefined();
  });
});
