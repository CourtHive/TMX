import { factoryConstants, drawDefinitionConstants, mocksEngine } from 'tods-competition-factory';
import { addTournament } from 'services/storage/importTournaments';

import { SUCCESS } from 'constants/tmxConstants';

const { FIRST_MATCH_LOSER_CONSOLATION, COMPASS, ROUND_ROBIN } = drawDefinitionConstants;
const { MALE, FEMALE } = factoryConstants.genderConstants;
const { DOUBLES } = factoryConstants.eventConstants;
const { WTN } = factoryConstants.ratingConstants;

export function mockTournaments(table) {
  const tournamentIds = table.getData().map((t) => t.tournamentId);
  const tournamentRecords = generateTournamentRecords();

  for (const tournamentRecord of tournamentRecords) {
    addTournament({ tournamentRecord, tournamentIds, table });
  }

  return { ...SUCCESS };
}

function generateTournamentRecords() {
  const clubCourts = {
    venueName: 'Super Fast Courts',
    venueAbbreviation: 'SFC',
    startTime: '08:00',
    endTime: '20:00',
    courtsCount: 8,
  };
  const venueProfiles = [clubCourts];
  const mockProfiles = [
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
  ];

  return mockProfiles.map((profile) => mocksEngine.generateTournamentRecord(profile).tournamentRecord);
}
