import { autoMapColumns } from './autoMapColumns';
import { describe, expect, it } from 'vitest';

const HEADER_FIRST_NAME = 'First Name';
const HEADER_LAST_NAME = 'Last Name';
const HEADER_DATE_OF_BIRTH = 'Date of Birth';

const FIRST_NAME = { kind: 'firstName' as const };
const LAST_NAME = { kind: 'lastName' as const };
const IGNORE = { kind: 'ignore' as const };

describe('autoMapColumns', () => {
  it('maps standard person columns', () => {
    const mapping = autoMapColumns([HEADER_FIRST_NAME, HEADER_LAST_NAME, 'Gender', HEADER_DATE_OF_BIRTH]);
    expect(mapping[0]).toEqual(FIRST_NAME);
    expect(mapping[1]).toEqual(LAST_NAME);
    expect(mapping[2]).toEqual({ kind: 'sex' });
    expect(mapping[3]).toEqual({ kind: 'birthDate' });
  });

  it('is case-insensitive and strips whitespace/underscores/hyphens', () => {
    const mapping = autoMapColumns(['first_name', 'LAST-NAME', 'NaTiOnAlItY']);
    expect(mapping[0]).toEqual(FIRST_NAME);
    expect(mapping[1]).toEqual(LAST_NAME);
    expect(mapping[2]).toEqual({ kind: 'nationalityCode' });
  });

  it('maps rating columns to their scale name', () => {
    const mapping = autoMapColumns(['UTR', 'WTN', 'NTRP', 'DUPR']);
    expect(mapping[0]).toEqual({ kind: 'rating', ratingScaleName: 'UTR' });
    expect(mapping[1]).toEqual({ kind: 'rating', ratingScaleName: 'WTN' });
    expect(mapping[2]).toEqual({ kind: 'rating', ratingScaleName: 'NTRP' });
    expect(mapping[3]).toEqual({ kind: 'rating', ratingScaleName: 'DUPR' });
  });

  it('allows multiple rating columns of different scales', () => {
    const mapping = autoMapColumns(['UTR Rating', 'WTN', 'NTRP']);
    expect(mapping[0]).toEqual({ kind: 'rating', ratingScaleName: 'UTR' });
    expect(mapping[1]).toEqual({ kind: 'rating', ratingScaleName: 'WTN' });
    expect(mapping[2]).toEqual({ kind: 'rating', ratingScaleName: 'NTRP' });
  });

  it('matches partial synonyms via the * prefix', () => {
    expect(autoMapColumns(['Birth'])[0]).toEqual({ kind: 'birthDate' });
    expect(autoMapColumns(['Birth Date'])[0]).toEqual({ kind: 'birthDate' });
    expect(autoMapColumns([HEADER_DATE_OF_BIRTH])[0]).toEqual({ kind: 'birthDate' });
  });

  it('first-match-wins for duplicate headers', () => {
    const mapping = autoMapColumns(['Email', 'Email', HEADER_FIRST_NAME, HEADER_FIRST_NAME]);
    expect(mapping[0]).toEqual({ kind: 'email' });
    expect(mapping[1]).toEqual(IGNORE);
    expect(mapping[2]).toEqual(FIRST_NAME);
    expect(mapping[3]).toEqual(IGNORE);
  });

  it('falls back to ignore for unrecognized headers', () => {
    const mapping = autoMapColumns(['Submission ID', 'T-Shirt Size', 'Random column']);
    expect(mapping[0]).toEqual(IGNORE);
    expect(mapping[1]).toEqual(IGNORE);
    expect(mapping[2]).toEqual(IGNORE);
  });

  it('handles empty / whitespace-only headers', () => {
    const mapping = autoMapColumns(['', '   ', HEADER_FIRST_NAME]);
    expect(mapping[0]).toEqual(IGNORE);
    expect(mapping[1]).toEqual(IGNORE);
    expect(mapping[2]).toEqual(FIRST_NAME);
  });

  it('exact match wins over partial match', () => {
    // "Birth Date" matches both the partial *birth and is an exact synonym;
    // exact match should always be used (Pass 1 runs before Pass 2).
    const mapping = autoMapColumns(['BirthDate']);
    expect(mapping[0]).toEqual({ kind: 'birthDate' });
  });

  it('maps a realistic mixed registration header set', () => {
    const headers = [
      'Submission Date',
      HEADER_FIRST_NAME,
      HEADER_LAST_NAME,
      'Email',
      'Phone',
      HEADER_DATE_OF_BIRTH,
      'Gender',
      'City',
      'State',
      'NTRP',
      'Notes',
    ];
    const mapping = autoMapColumns(headers);
    expect(mapping[0]).toEqual(IGNORE); // Submission Date — no synonym
    expect(mapping[1]).toEqual(FIRST_NAME);
    expect(mapping[2]).toEqual(LAST_NAME);
    expect(mapping[3]).toEqual({ kind: 'email' });
    expect(mapping[4]).toEqual({ kind: 'phone' });
    expect(mapping[5]).toEqual({ kind: 'birthDate' });
    expect(mapping[6]).toEqual({ kind: 'sex' });
    expect(mapping[7]).toEqual({ kind: 'city' });
    expect(mapping[8]).toEqual({ kind: 'state' });
    expect(mapping[9]).toEqual({ kind: 'rating', ratingScaleName: 'NTRP' });
    expect(mapping[10]).toEqual({ kind: 'notes' });
  });
});
