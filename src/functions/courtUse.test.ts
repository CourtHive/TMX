import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildCourtsDisabledMethods,
  buildCourtsEnableMethods,
  buildVenuesDisabledMethods,
  buildVenuesEnableMethods,
  courtUseState,
  describeMatchUpOnCourt,
  isCourtDisabled,
  isCourtDisabledAnyDate,
  matchUpsOnCourts,
  disabledCourtIds,
  refusedPlacementCourtIds,
} from './courtUse';

// constants
import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';

const startDate = '2026-06-01';
const secondDate = '2026-06-02';
const endDate = '2026-06-05';

let courtA: string;
let courtB: string;
let venueId: string;

function grid(): { courts: any[]; venues: any[] } {
  const { courts = [], venues = [] }: any = tournamentEngine.getVenuesAndCourts();
  return { courts, venues };
}

function courtWithVenue(courtId: string) {
  const { courts, venues } = grid();
  const court = courts.find((c: any) => c.courtId === courtId);
  const venue = venues.find((v: any) => v.venueId === court.venueId);
  return { court, venue };
}

function placeMethod(matchUp: any, courtId: string, scheduledDate: string, courtOrder: number) {
  return {
    method: ADD_MATCHUP_SCHEDULE_ITEMS,
    params: {
      matchUpId: matchUp.matchUpId,
      drawId: matchUp.drawId,
      schedule: { courtId, venueId, scheduledDate, courtOrder },
      removePriorValues: true,
    },
  };
}

function firstRoundMatchUps() {
  const { matchUps = [] }: any = tournamentEngine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } });
  return matchUps.toSorted((a: any, b: any) => a.matchUpId.localeCompare(b.matchUpId));
}

beforeEach(() => {
  mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawId: 'd1', drawSize: 16 }],
    venueProfiles: [{ venueId: 'v1', courtsCount: 2 }],
    setState: true,
    startDate,
    endDate,
  });
  venueId = 'v1';
  [courtA, courtB] = grid().courts.map((c: any) => c.courtId);
});

describe('not using a court', () => {
  it('on every date: the court is not in use on any date and its matchUps are listed, not moved', () => {
    const [m1, m2, m3] = firstRoundMatchUps();
    let result: any = tournamentEngine.executionQueue([
      placeMethod(m1, courtA, startDate, 1),
      placeMethod(m2, courtA, secondDate, 1),
      placeMethod(m3, courtB, startDate, 1),
    ]);
    expect(result.success).toEqual(true);

    result = tournamentEngine.executionQueue(buildCourtsDisabledMethods({ courtIds: [courtA] }));
    expect(result.success).toEqual(true);

    const { court, venue } = courtWithVenue(courtA);
    expect(courtUseState({ court, venue })).toEqual({ allDates: true, dates: [], venueDisabled: false });
    expect(isCourtDisabled({ court, venue, date: startDate })).toEqual(true);
    expect(isCourtDisabled({ court, venue, date: endDate })).toEqual(true);
    expect([...disabledCourtIds({ ...grid(), date: secondDate })]).toEqual([courtA]);

    const matchUps: any[] = tournamentEngine.allTournamentMatchUps().matchUps ?? [];
    const listed = matchUpsOnCourts({ matchUps, courtIds: [courtA] });
    expect(listed.map((m: any) => m.matchUpId)).toEqual([m1.matchUpId, m2.matchUpId]);
    expect(matchUpsOnCourts({ matchUps, courtIds: [courtA], date: secondDate }).length).toEqual(1);
    // nothing was moved
    expect(listed.every((m: any) => m.schedule.courtId === courtA)).toEqual(true);
    expect(describeMatchUpOnCourt(listed[0])).toContain(startDate);
  });

  it('on the selected date only: not in use on that date, in use on the others', () => {
    const result: any = tournamentEngine.executionQueue(
      buildCourtsDisabledMethods({ courtIds: [courtA], date: startDate }),
    );
    expect(result.success).toEqual(true);

    const { court, venue } = courtWithVenue(courtA);
    expect(courtUseState({ court, venue })).toEqual({
      allDates: false,
      dates: [startDate],
      venueDisabled: false,
    });
    expect(isCourtDisabled({ court, venue, date: startDate })).toEqual(true);
    expect(isCourtDisabled({ court, venue, date: secondDate })).toEqual(false);
    expect(isCourtDisabledAnyDate({ court, venue })).toEqual(true);
    expect([...disabledCourtIds({ ...grid(), date: secondDate })]).toEqual([]);
  });

  it('excludes completed matchUps from the list', () => {
    const [m1, m2] = firstRoundMatchUps();
    tournamentEngine.executionQueue([placeMethod(m1, courtA, startDate, 1), placeMethod(m2, courtA, startDate, 2)]);
    const { outcome } = mocksEngine.generateOutcomeFromScoreString({ scoreString: '6-1 6-1', winningSide: 1 });
    const result: any = tournamentEngine.setMatchUpStatus({ matchUpId: m1.matchUpId, drawId: m1.drawId, outcome });
    expect(result.success).toEqual(true);

    const matchUps: any[] = tournamentEngine.allTournamentMatchUps().matchUps ?? [];
    expect(matchUpsOnCourts({ matchUps, courtIds: [courtA] }).map((m: any) => m.matchUpId)).toEqual([m2.matchUpId]);
  });
});

describe('using a court again', () => {
  it('on every date clears a dated and an undated disable', () => {
    tournamentEngine.executionQueue(buildCourtsDisabledMethods({ courtIds: [courtA] }));
    let result: any = tournamentEngine.executionQueue(buildCourtsEnableMethods({ courtIds: [courtA] }));
    expect(result.success).toEqual(true);
    let { court, venue } = courtWithVenue(courtA);
    expect(isCourtDisabledAnyDate({ court, venue })).toEqual(false);

    tournamentEngine.executionQueue(buildCourtsDisabledMethods({ courtIds: [courtA], date: startDate }));
    result = tournamentEngine.executionQueue(buildCourtsEnableMethods({ courtIds: [courtA] }));
    expect(result.success).toEqual(true);
    ({ court, venue } = courtWithVenue(courtA));
    expect(isCourtDisabledAnyDate({ court, venue })).toEqual(false);
  });

  it('on one date returns only that date', () => {
    tournamentEngine.executionQueue(buildCourtsDisabledMethods({ courtIds: [courtA], date: startDate }));
    tournamentEngine.executionQueue(buildCourtsDisabledMethods({ courtIds: [courtA], date: secondDate }));
    let { court, venue } = courtWithVenue(courtA);
    // the factory replaces the stored dates rather than adding to them ...
    expect(courtUseState({ court, venue }).dates).toEqual([secondDate]);
    // ... so the builder carries the existing dates forward
    tournamentEngine.executionQueue(
      buildCourtsDisabledMethods({ courtIds: [courtA], date: startDate, existingDates: [secondDate] }),
    );
    ({ court, venue } = courtWithVenue(courtA));
    expect(courtUseState({ court, venue }).dates).toEqual([startDate, secondDate]);

    const result: any = tournamentEngine.executionQueue(
      buildCourtsEnableMethods({ courtIds: [courtA], date: secondDate }),
    );
    expect(result.success).toEqual(true);
    ({ court, venue } = courtWithVenue(courtA));
    expect(isCourtDisabled({ court, venue, date: secondDate })).toEqual(false);
    expect(isCourtDisabled({ court, venue, date: startDate })).toEqual(true);
  });
});

describe('venues not in use', () => {
  it('takes every court in the venue out on every date, and puts them back', () => {
    let result: any = tournamentEngine.executionQueue(buildVenuesDisabledMethods({ venueIds: [venueId] }));
    expect(result.success).toEqual(true);

    const { court, venue } = courtWithVenue(courtB);
    expect(courtUseState({ court, venue }).venueDisabled).toEqual(true);
    expect(isCourtDisabled({ court, venue, date: endDate })).toEqual(true);
    expect([...disabledCourtIds({ ...grid(), date: startDate })].sort((a, b) => a.localeCompare(b))).toEqual(
      [courtA, courtB].sort((a, b) => a.localeCompare(b)),
    );

    result = tournamentEngine.executionQueue(buildVenuesEnableMethods({ venueIds: [venueId] }));
    expect(result.success).toEqual(true);
    expect(disabledCourtIds({ ...grid(), date: startDate }).size).toEqual(0);
  });
});

describe('refusing placements', () => {
  it('refuses a placement onto a court not in use and allows it elsewhere or once used again', () => {
    const [m1] = firstRoundMatchUps();
    tournamentEngine.executionQueue(buildCourtsDisabledMethods({ courtIds: [courtA], date: startDate }));

    const ontoA = [placeMethod(m1, courtA, startDate, 1)];
    expect(refusedPlacementCourtIds({ methods: ontoA, ...grid(), date: startDate })).toEqual([courtA]);
    // the placement's own date decides: courtA is in use on the second date
    expect(
      refusedPlacementCourtIds({ methods: [placeMethod(m1, courtA, secondDate, 1)], ...grid(), date: startDate }),
    ).toEqual([]);
    expect(
      refusedPlacementCourtIds({ methods: [placeMethod(m1, courtB, startDate, 1)], ...grid(), date: startDate }),
    ).toEqual([]);

    tournamentEngine.executionQueue(buildCourtsEnableMethods({ courtIds: [courtA] }));
    expect(refusedPlacementCourtIds({ methods: ontoA, ...grid(), date: startDate })).toEqual([]);
  });

  it('never refuses clearing a placement, so a matchUp can always leave the court', () => {
    const [m1] = firstRoundMatchUps();
    tournamentEngine.executionQueue([placeMethod(m1, courtA, startDate, 1)]);
    tournamentEngine.executionQueue(buildVenuesDisabledMethods({ venueIds: [venueId] }));
    const clear = [
      {
        method: ADD_MATCHUP_SCHEDULE_ITEMS,
        params: {
          matchUpId: m1.matchUpId,
          drawId: m1.drawId,
          schedule: { courtId: '', venueId: '', courtOrder: '', scheduledDate: '' },
          removePriorValues: true,
        },
      },
    ];
    expect(refusedPlacementCourtIds({ methods: clear, ...grid(), date: startDate })).toEqual([]);
  });

  it('reads the legacy disabled extension as well as the first-class attribute', () => {
    const court = { courtId: 'c', extensions: [{ name: 'disabled', value: { dates: [startDate] } }] };
    expect(isCourtDisabled({ court, date: startDate })).toEqual(true);
    expect(isCourtDisabled({ court, date: secondDate })).toEqual(false);
  });
});
