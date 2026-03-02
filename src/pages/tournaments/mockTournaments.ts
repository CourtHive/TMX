/**
 * Mock tournament generation for testing and demo purposes.
 * Creates sample tournaments with various draw types and categories.
 */
import { factoryConstants, drawDefinitionConstants, mocksEngine } from 'tods-competition-factory';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { getLoginState } from 'services/authentication/loginState';

import { SUCCESS } from 'constants/tmxConstants';

const {
  FIRST_MATCH_LOSER_CONSOLATION,
  FIRST_ROUND_LOSER_CONSOLATION,
  ROUND_ROBIN_WITH_PLAYOFF,
  FEED_IN_CHAMPIONSHIP,
  SINGLE_ELIMINATION,
  ROUND_ROBIN,
  COMPASS,
} = drawDefinitionConstants;

const { WTN, DUPR, PSA, BWF, USATT } = factoryConstants.ratingConstants;
const { DOUBLES, SINGLES, TEAM } = factoryConstants.eventConstants;
const { MALE, FEMALE, MIXED } = factoryConstants.genderConstants;

// Sport-specific matchUpFormat codes (not in factory constants)
const FORMAT_TB11 = 'SET3-S:TB11'; // Pickleball standard (best of 3, tiebreak sets to 11)
const FORMAT_TB11_BO5 = 'SET5-S:TB11'; // Table Tennis / Squash (best of 5, tiebreak sets to 11)
const FORMAT_TB21 = 'SET3-S:TB21'; // Badminton (best of 3, tiebreak sets to 21)
const FORMAT_TIMED_10 = 'SET1A-S:T10'; // INTENNSE doubles (1 × 10-min aggregate timed)
const FORMAT_WIFFLE = 'INN4XA-S:T12'; // BLW Wiffle Ball (4 innings, aggregate, ~12 min/inning approx)

export function mockTournaments(table?: any, onComplete?: () => void, indices?: number[]): any {
  const tournamentIds = table?.getData().map((t: any) => t.tournamentId) ?? [];
  const tournamentRecords = generateTournamentRecords(indices);
  const provider = getLoginState()?.provider;

  const savePromises: Promise<void>[] = [];

  for (const tournamentRecord of tournamentRecords) {
    const rowData = mapTournamentRecord(tournamentRecord);
    const existsInCalendar = tournamentIds.includes(tournamentRecord.tournamentId);
    if (existsInCalendar) {
      table?.updateOrAddData([rowData], true);
    } else {
      table?.addData([rowData], true);
    }

    if (provider && !tournamentRecord.parentOrganisation) tournamentRecord.parentOrganisation = provider;
    savePromises.push(saveTournamentRecord({ tournamentRecord }));
  }

  if (onComplete) {
    Promise.all(savePromises).then(onComplete);
  }

  return { ...SUCCESS };
}

const clubCourts = {
  venueName: 'Super Fast Courts',
  venueAbbreviation: 'SFC',
  startTime: '08:00',
  endTime: '20:00',
  courtsCount: 8,
};
const venueProfiles = [clubCourts];

const dinkCityCourts = {
  venueName: 'Dink City Courts',
  venueAbbreviation: 'DCC',
  startTime: '07:00',
  endTime: '21:00',
  courtsCount: 12,
};

const typtiArena = {
  venueName: 'TYPTI Arena',
  venueAbbreviation: 'TYP',
  startTime: '09:00',
  endTime: '18:00',
  courtsCount: 4,
};

const padelClub = {
  venueName: 'Padel Club Central',
  venueAbbreviation: 'PCC',
  startTime: '08:00',
  endTime: '22:00',
  courtsCount: 6,
};

const spinCenter = {
  venueName: 'Spin Center',
  venueAbbreviation: 'SPC',
  startTime: '09:00',
  endTime: '21:00',
  courtsCount: 16,
};

const glassCourtClub = {
  venueName: 'Glass Court Club',
  venueAbbreviation: 'GCC',
  startTime: '07:00',
  endTime: '22:00',
  courtsCount: 6,
};

const shuttleSportsHall = {
  venueName: 'Shuttle Sports Hall',
  venueAbbreviation: 'SSH',
  startTime: '08:00',
  endTime: '21:00',
  courtsCount: 8,
};

const intennseArena = {
  venueName: 'INTENNSE Arena',
  venueAbbreviation: 'INA',
  startTime: '18:00',
  endTime: '22:00',
  courtsCount: 1,
};

const wiffleballPark = {
  venueName: 'Wiffle Ball Park',
  venueAbbreviation: 'WBP',
  startTime: '08:00',
  endTime: '18:00',
  courtsCount: 4,
};

const mockProfiles = [
  // Tournament 1: CourtHive Challenge (existing)
  {
    tournamentAttributes: { tournamentId: 'tournament-id-1' },
    participantsProfile: { scaledParticipantsCount: 200, idPrefix: 'p' },
    tournamentName: 'CourtHive Challenge',
    drawProfiles: [
      {
        category: { categoryName: 'U18' },
        eventName: 'U18 Boys Doubles',
        eventId: 'event-id-1',
        drawId: 'draw-id-1',
        eventType: DOUBLES,
        gender: MALE,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        drawType: FIRST_MATCH_LOSER_CONSOLATION,
        category: { categoryName: 'U16' },
        eventName: 'U16 Girls Singles',
        eventId: 'event-id-2',
        drawId: 'draw-id-2',
        gender: FEMALE,
        seedsCount: 8,
        drawSize: 32,
      },
      {
        category: { ratingType: WTN, ratingMin: 18, ratingMax: 24.99 },
        eventName: `WTN 18-25 SINGLES`,
        scaledParticipantsCount: 32,
        eventId: 'event-id-3',
        drawId: 'draw-id-3',
        seedsCount: 8,
        drawSize: 32,
      },
      {
        category: { ratingType: WTN, ratingMin: 18, ratingMax: 24.99 },
        eventName: `WTN 18-25 DOUBLES`,
        scaledParticipantsCount: 32,
        eventId: 'event-id-4',
        drawId: 'draw-id-4',
        eventType: DOUBLES,
        seedsCount: 8,
        drawSize: 32,
      },
    ],
    venueProfiles,
  },
  // Tournament 2: Level Based Play (existing)
  {
    tournamentAttributes: { tournamentId: 'tournament-id-02' },
    participantsProfile: { idPrefix: 'p' },
    tournamentName: 'Level Based Play',
    drawProfiles: [
      {
        eventName: `WTN 14-19 SINGLES`,
        category: { ratingType: WTN, ratingMin: 14, ratingMax: 19.99 },
        scaledParticipantsCount: 32,
        eventId: 'event-id-1',
        drawId: 'draw-id-1',
        drawType: COMPASS,
        seedsCount: 8,
        drawSize: 32,
      },
      {
        eventName: `WTN 20-26 SINGLES`,
        category: { ratingType: WTN, ratingMin: 20, ratingMax: 25.99 },
        scaledParticipantsCount: 16,
        drawType: ROUND_ROBIN,
        eventId: 'event-id-2',
        drawId: 'draw-id-2',
        seedsCount: 4,
        drawSize: 16,
      },
    ],
    venueProfiles,
  },
  // Tournament 3: DUPR Pickleball Classic
  {
    tournamentAttributes: { tournamentId: 'tournament-id-pb-01' },
    participantsProfile: {
      scaledParticipantsCount: 80,
      category: { ratingType: DUPR, ratingMin: 3, ratingMax: 5.99 },
      idPrefix: 'pb',
    },
    tournamentName: 'DUPR Pickleball Classic',
    completeAllMatchUps: true,
    drawProfiles: [
      {
        category: { ratingType: DUPR, ratingMin: 3, ratingMax: 4.49 },
        matchUpFormat: FORMAT_TB11,
        eventName: 'DUPR 3.0-4.5 Singles',
        drawType: ROUND_ROBIN,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        category: { ratingType: DUPR, ratingMin: 4.5, ratingMax: 5.99 },
        matchUpFormat: FORMAT_TB11,
        eventName: 'DUPR 4.5-6.0 Doubles',
        drawType: SINGLE_ELIMINATION,
        eventType: DOUBLES,
        seedsCount: 4,
        drawSize: 16,
        qualifyingProfiles: [
          {
            roundTarget: 1,
            structureProfiles: [{ drawSize: 8, qualifyingPositions: 4 }],
          },
        ],
      },
      {
        category: { ratingType: DUPR, ratingMin: 3, ratingMax: 4.49 },
        matchUpFormat: FORMAT_TB11,
        eventName: 'DUPR 3.0-4.5 Mixed Doubles',
        drawType: ROUND_ROBIN_WITH_PLAYOFF,
        eventType: DOUBLES,
        seedsCount: 2,
        drawSize: 8,
      },
    ],
    venueProfiles: [dinkCityCourts],
  },
  // Tournament 4: Pickleball Formats Showcase
  {
    tournamentAttributes: { tournamentId: 'tournament-id-pb-02' },
    participantsProfile: { idPrefix: 'pf' },
    tournamentName: 'Pickleball Formats Showcase',
    completeAllMatchUps: true,
    drawProfiles: [
      {
        matchUpFormat: 'SET3-S:TB11@RALLY',
        eventName: 'Rally Scoring Singles',
        drawType: SINGLE_ELIMINATION,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        matchUpFormat: 'SET3-S:TB15',
        eventName: 'Traditional 15 Doubles',
        drawType: ROUND_ROBIN,
        eventType: DOUBLES,
        seedsCount: 2,
        drawSize: 8,
      },
      {
        matchUpFormat: 'SET5-S:TB21@RALLY-F:TB15@RALLY',
        eventName: 'MLP Format Mixed Doubles',
        drawType: ROUND_ROBIN_WITH_PLAYOFF,
        eventType: DOUBLES,
        seedsCount: 2,
        drawSize: 8,
      },
      {
        matchUpFormat: 'SET1-S:TB11',
        eventName: 'Single Game Sprint',
        drawType: SINGLE_ELIMINATION,
        drawSize: 8,
      },
    ],
    venueProfiles: [dinkCityCourts],
  },
  // Tournament 5: TYPTI Invitational
  {
    tournamentAttributes: { tournamentId: 'tournament-id-ty-01' },
    participantsProfile: { idPrefix: 'ty' },
    tournamentName: 'TYPTI Invitational',
    completeAllMatchUps: true,
    drawProfiles: [
      {
        matchUpFormat: 'SET5-S:5-G:3C',
        eventName: 'TYPTI Standard Singles',
        drawType: SINGLE_ELIMINATION,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        matchUpFormat: 'SET3-S:4-G:2C',
        eventName: 'TYPTI Short Format',
        drawType: ROUND_ROBIN,
        seedsCount: 2,
        drawSize: 8,
      },
    ],
    venueProfiles: [typtiArena],
  },
  // Tournament 6: Padel Club Championship
  {
    tournamentAttributes: { tournamentId: 'tournament-id-pd-01' },
    participantsProfile: { idPrefix: 'pd' },
    tournamentName: 'Padel Club Championship',
    completeAllMatchUps: true,
    drawProfiles: [
      {
        matchUpFormat: 'SET3-S:6/TB7',
        eventName: 'Open Doubles',
        drawType: ROUND_ROBIN_WITH_PLAYOFF,
        eventType: DOUBLES,
        gender: MALE,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        matchUpFormat: 'SET3-S:6NOAD/TB7',
        eventName: 'Women Golden Point',
        drawType: SINGLE_ELIMINATION,
        eventType: DOUBLES,
        gender: FEMALE,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        matchUpFormat: 'SET3-S:4/TB7',
        eventName: 'Mixed Doubles Short Set',
        drawType: ROUND_ROBIN,
        eventType: DOUBLES,
        seedsCount: 2,
        drawSize: 8,
      },
    ],
    venueProfiles: [padelClub],
  },
  // Tournament 7: Table Tennis Open
  {
    tournamentAttributes: { tournamentId: 'tournament-id-tt-01' },
    participantsProfile: {
      scaledParticipantsCount: 64,
      category: { ratingType: USATT, ratingMin: 1000, ratingMax: 2400 },
      idPrefix: 'tt',
    },
    tournamentName: 'Table Tennis Open',
    completeAllMatchUps: true,
    drawProfiles: [
      {
        category: { ratingType: USATT, ratingMin: 1000, ratingMax: 1800 },
        matchUpFormat: FORMAT_TB11_BO5,
        eventName: 'USATT 1000-1800 Singles',
        drawType: ROUND_ROBIN_WITH_PLAYOFF,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        category: { ratingType: USATT, ratingMin: 1800, ratingMax: 2400 },
        matchUpFormat: FORMAT_TB11_BO5,
        eventName: 'USATT 1800-2400 Singles',
        drawType: SINGLE_ELIMINATION,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        matchUpFormat: FORMAT_TB11,
        eventName: 'Open Doubles',
        drawType: ROUND_ROBIN,
        eventType: DOUBLES,
        seedsCount: 2,
        drawSize: 8,
      },
    ],
    venueProfiles: [spinCenter],
  },
  // Tournament 8: Squash Gold Open
  {
    tournamentAttributes: { tournamentId: 'tournament-id-sq-01' },
    participantsProfile: {
      scaledParticipantsCount: 64,
      category: { ratingType: PSA, ratingMin: 0, ratingMax: 1500 },
      idPrefix: 'sq',
    },
    tournamentName: 'Squash Gold Open',
    completeAllMatchUps: true,
    drawProfiles: [
      {
        category: { ratingType: PSA, ratingMin: 0, ratingMax: 1500 },
        matchUpFormat: FORMAT_TB11_BO5,
        eventName: 'PSA Men Singles',
        drawType: SINGLE_ELIMINATION,
        gender: MALE,
        seedsCount: 8,
        drawSize: 32,
        qualifyingProfiles: [
          {
            roundTarget: 1,
            structureProfiles: [{ drawSize: 16, qualifyingPositions: 4 }],
          },
        ],
      },
      {
        category: { ratingType: PSA, ratingMin: 0, ratingMax: 1500 },
        matchUpFormat: FORMAT_TB11,
        eventName: 'PSA Women Singles',
        drawType: FEED_IN_CHAMPIONSHIP,
        gender: FEMALE,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        matchUpFormat: FORMAT_TB11_BO5,
        eventName: 'Club Doubles',
        drawType: FIRST_ROUND_LOSER_CONSOLATION,
        eventType: DOUBLES,
        seedsCount: 4,
        drawSize: 16,
      },
    ],
    venueProfiles: [glassCourtClub],
  },
  // Tournament 9: Badminton Grand Prix
  {
    tournamentAttributes: { tournamentId: 'tournament-id-bd-01' },
    participantsProfile: {
      scaledParticipantsCount: 64,
      category: { ratingType: BWF, ratingMin: 0, ratingMax: 80000 },
      idPrefix: 'bd',
    },
    tournamentName: 'Badminton Grand Prix',
    completeAllMatchUps: true,
    drawProfiles: [
      {
        category: { ratingType: BWF, ratingMin: 0, ratingMax: 80000 },
        matchUpFormat: FORMAT_TB21,
        eventName: 'BWF Men Singles',
        drawType: ROUND_ROBIN_WITH_PLAYOFF,
        gender: MALE,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        category: { ratingType: BWF, ratingMin: 0, ratingMax: 80000 },
        matchUpFormat: FORMAT_TB21,
        eventName: 'BWF Women Singles',
        drawType: SINGLE_ELIMINATION,
        gender: FEMALE,
        seedsCount: 4,
        drawSize: 16,
        qualifyingProfiles: [
          {
            roundTarget: 1,
            structureProfiles: [{ drawSize: 8, qualifyingPositions: 4 }],
          },
        ],
      },
      {
        matchUpFormat: FORMAT_TB21,
        eventName: 'Mixed Doubles',
        drawType: FIRST_MATCH_LOSER_CONSOLATION,
        eventType: DOUBLES,
        seedsCount: 4,
        drawSize: 16,
      },
    ],
    venueProfiles: [shuttleSportsHall],
  },
  // Tournament 10: INTENNSE Showdown (Team event)
  {
    tournamentAttributes: { tournamentId: 'tournament-id-in-01' },
    participantsProfile: { participantsCount: 0, idPrefix: 'in' },
    tournamentName: 'INTENNSE Showdown',
    completeAllMatchUps: true,
    drawProfiles: [
      {
        eventType: TEAM,
        drawType: SINGLE_ELIMINATION,
        drawSize: 2,
        teamNames: ['The Authentics', 'Cauldron'],
        teamGenders: { MALE: 3, FEMALE: 3 },
        tieFormat: {
          tieFormatName: 'INTENNSE',
          winCriteria: { aggregateValue: true },
          collectionDefinitions: [
            {
              collectionId: 'intennse-ms',
              collectionName: "Men's Singles",
              matchUpType: SINGLES,
              matchUpCount: 2,
              matchUpFormat: 'SET2XA-S:T10',
              scoreValue: 1,
              gender: MALE,
              category: { categoryName: 'MS' },
            },
            {
              collectionId: 'intennse-ws',
              collectionName: "Women's Singles",
              matchUpType: SINGLES,
              matchUpCount: 2,
              matchUpFormat: 'SET2XA-S:T10',
              scoreValue: 1,
              gender: FEMALE,
              category: { categoryName: 'WS' },
            },
            {
              collectionId: 'intennse-md',
              collectionName: "Men's Doubles",
              matchUpType: DOUBLES,
              matchUpCount: 1,
              matchUpFormat: FORMAT_TIMED_10,
              scoreValue: 1,
              gender: MALE,
              category: { categoryName: 'MD' },
            },
            {
              collectionId: 'intennse-wd',
              collectionName: "Women's Doubles",
              matchUpType: DOUBLES,
              matchUpCount: 1,
              matchUpFormat: FORMAT_TIMED_10,
              scoreValue: 1,
              gender: FEMALE,
              category: { categoryName: 'WD' },
            },
            {
              collectionId: 'intennse-xd',
              collectionName: 'Mixed Doubles',
              matchUpType: DOUBLES,
              matchUpCount: 1,
              matchUpFormat: FORMAT_TIMED_10,
              scoreValue: 1,
              gender: MIXED,
              category: { categoryName: 'XD' },
            },
          ],
        },
      },
    ],
    venueProfiles: [intennseArena],
  },
  // Tournament 11: BLW Wiffle Ball Classic
  {
    tournamentAttributes: { tournamentId: 'tournament-id-wb-01' },
    participantsProfile: { scaledParticipantsCount: 32, idPrefix: 'wb' },
    tournamentName: 'BLW Wiffle Ball Classic',
    completeAllMatchUps: true,
    drawProfiles: [
      {
        matchUpFormat: FORMAT_WIFFLE,
        eventName: 'Competitive Division',
        drawType: ROUND_ROBIN_WITH_PLAYOFF,
        seedsCount: 4,
        drawSize: 16,
      },
      {
        matchUpFormat: FORMAT_WIFFLE,
        eventName: 'Recreational Division',
        drawType: ROUND_ROBIN_WITH_PLAYOFF,
        seedsCount: 2,
        drawSize: 8,
      },
    ],
    venueProfiles: [wiffleballPark],
  },
].filter((t) => !['INTENNSE Showdown', 'BLW Wiffle Ball Classic'].includes(t.tournamentName));

export const EXAMPLE_TOURNAMENT_CATALOG = mockProfiles.map((p, i) => ({
  label: p.tournamentName,
  value: i,
}));

function generateTournamentRecords(indices?: number[]): any[] {
  const profiles = indices ? indices.map((i) => mockProfiles[i]).filter(Boolean) : mockProfiles;
  return profiles.map((profile) => mocksEngine.generateTournamentRecord(profile).tournamentRecord);
}
