import type { Page } from '@playwright/test';

/**
 * Mock tournament profile shape for seeding test data via mocksEngine.
 *
 * This is the subset of mocksEngine.generateTournamentRecord params
 * that E2E tests commonly use. The full surface is much richer —
 * see factory docs or TMX/src/pages/tournaments/mockTournaments.ts
 * for the 11 pre-built profiles.
 */
export interface MockProfile {
  tournamentName?: string;
  tournamentAttributes?: { tournamentId?: string; [key: string]: unknown };
  participantsProfile?: { scaledParticipantsCount?: number; [key: string]: unknown };
  drawProfiles?: Array<{
    eventName?: string;
    drawSize?: number;
    seedsCount?: number;
    drawType?: string;
    completionGoal?: number;
    [key: string]: unknown;
  }>;
  venueProfiles?: Array<{
    courtsCount?: number;
    venueName?: string;
    [key: string]: unknown;
  }>;
  completeAllMatchUps?: boolean;
  [key: string]: unknown;
}

/**
 * Seed a tournament into TMX via dev.factory.mocksEngine.
 *
 * This is the testing superpower: programmatically generate any
 * tournament state as a starting point for journey tests. Skip
 * all the UI clicking to create test data.
 *
 * The pattern:
 *   mocksEngine.generateTournamentRecord(params) → setState → load → navigate → assert
 *
 * Returns the tournamentId of the generated tournament.
 */
export async function seedTournament(page: Page, profile: MockProfile): Promise<string> {
  return page.evaluate((p: MockProfile) => {
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      setState: true,
      ...p,
    });
    dev.load(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  }, profile);
}

/**
 * Load an existing tournament record JSON into TMX.
 * Useful for replaying recorded tournament states as test fixtures.
 */
export async function loadTournament(page: Page, tournamentRecord: Record<string, unknown>): Promise<string> {
  return page.evaluate((record) => {
    dev.factory.tournamentEngine.setState(record);
    dev.load(record);
    return record.tournamentId as string;
  }, tournamentRecord);
}

/**
 * Get the current tournament record from the factory engine.
 */
export async function getTournamentRecord(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => dev.getTournament());
}

// ---------- Pre-built profiles for common journey starting points ----------

/** Empty tournament with 32 participants, no events */
export const PROFILE_EMPTY_TOURNAMENT: MockProfile = {
  tournamentName: 'E2E Empty Tournament',
  tournamentAttributes: { tournamentId: 'e2e-empty' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [],
};

/** Tournament with a 16-draw SE event, entries accepted, no scores */
export const PROFILE_DRAW_GENERATED: MockProfile = {
  tournamentName: 'E2E Draw Generated',
  tournamentAttributes: { tournamentId: 'e2e-draw-generated' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 16,
      seedsCount: 4,
      drawType: 'SINGLE_ELIMINATION',
    },
  ],
};

/** Tournament with a 16-draw SE event, R1 completed (8 matchUps scored) */
export const PROFILE_R1_COMPLETE: MockProfile = {
  tournamentName: 'E2E Round 1 Complete',
  tournamentAttributes: { tournamentId: 'e2e-r1-complete' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 16,
      seedsCount: 4,
      drawType: 'SINGLE_ELIMINATION',
      completionGoal: 8,
    },
  ],
};

/** Tournament with a 16-draw SE event, fully completed */
export const PROFILE_COMPLETED: MockProfile = {
  tournamentName: 'E2E Completed Tournament',
  tournamentAttributes: { tournamentId: 'e2e-completed' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 16,
      seedsCount: 4,
      drawType: 'SINGLE_ELIMINATION',
    },
  ],
  completeAllMatchUps: true,
};

/** Tournament with venues and courts for scheduling journeys */
export const PROFILE_WITH_VENUES: MockProfile = {
  tournamentName: 'E2E With Venues',
  tournamentAttributes: { tournamentId: 'e2e-with-venues' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 16,
      seedsCount: 4,
      drawType: 'SINGLE_ELIMINATION',
    },
  ],
  venueProfiles: [{ courtsCount: 8, venueName: 'Center Court Complex' }],
};

/**
 * Seed a TEAM tournament AND attach non-COMPETITOR participants (coach /
 * medical / physio / captain …) to each team in a single page.evaluate.
 *
 * Why a dedicated helper: `mocksEngine` only emits COMPETITORs when it
 * assembles a TEAM event — `buildTeamParticipants` filters by
 * `participantRole === COMPETITOR` by design. Coaches and staff have to be
 * added in a second step that:
 *
 *   1. creates INDIVIDUAL participants with the staff role + a
 *      `person.biographicalInformation.teamAttributes[0].teamName` that
 *      matches the team's `participantName`
 *   2. persists the mutated record to IDB (single .put() so we don't race
 *      the seed helper's fire-and-forget `dev.load` write — same gotcha
 *      seedAndScheduleFirstMatchUp dodges in Journey 29)
 *
 * `splitMembership` (the function teamProfileModal consumes) re-routes
 * these extras into the Coaches / Staff buckets by walking
 * `q.participants()` and matching `teamAttributes[0].teamName`.
 *
 * Returns: tournamentId, the two seeded team names, and the team participant
 * ids so the journey can target a specific team in assertions.
 */
export interface StaffMember {
  /** Factory `participantRole` constant — COACH / MEDICAL / PHYSIO /
   *  TRAINER / CAPTAIN / …. Goes straight through to `splitMembership`'s
   *  bucket-routing. */
  role: string;
  /** participantName for the added INDIVIDUAL participant. */
  name: string;
  /** The team this staff member belongs to. MUST match a team's
   *  `participantName` exactly — `splitMembership` matches via
   *  `teamAttributes[0].teamName === team.participantName`. */
  teamName: string;
}

export async function seedTeamTournamentWithStaff(
  page: Page,
  opts: {
    teamNames?: [string, string];
    playersPerTeam?: number;
    staff: StaffMember[];
  },
): Promise<{ tournamentId: string; teamNames: [string, string]; teamIds: Record<string, string> }> {
  const teamNames = opts.teamNames ?? ['The Authentics', 'Cauldron'];
  const playersPerTeam = opts.playersPerTeam ?? 6;

  return page.evaluate(
    async ({ teamNames, playersPerTeam, staff }) => {
      try {
        await dev.tmx2db.initDB();

        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          setState: true,
          tournamentName: 'E2E Team Profile',
          tournamentAttributes: { tournamentId: 'e2e-team-profile' },
          participantsProfile: { participantsCount: 0 },
          drawProfiles: [
            {
              eventType: 'TEAM',
              drawType: 'SINGLE_ELIMINATION',
              drawSize: 2,
              teamNames,
              teamGenders: {
                MALE: Math.ceil(playersPerTeam / 2),
                FEMALE: Math.floor(playersPerTeam / 2),
              },
              tieFormat: {
                tieFormatName: 'INTENNSE',
                winCriteria: { aggregateValue: true },
                collectionDefinitions: [
                  {
                    collectionId: 'cd-ms',
                    collectionName: "Men's Singles",
                    matchUpType: 'SINGLES',
                    matchUpCount: 1,
                    scoreValue: 1,
                    gender: 'MALE',
                  },
                ],
              },
            },
          ],
        });

        const teamIds: Record<string, string> = {};
        const teams = (tournamentRecord.participants ?? []).filter((p: any) => p.participantType === 'TEAM');
        for (const team of teams) {
          if (team.participantName) teamIds[team.participantName] = team.participantId;
        }

        if (staff.length) {
          const staffParticipants = staff.map((m) => ({
            participantId: `staff-${m.teamName.toLowerCase().replace(/\W+/g, '-')}-${m.role.toLowerCase()}-${m.name.toLowerCase().replace(/\W+/g, '-')}`,
            participantName: m.name,
            participantType: 'INDIVIDUAL',
            participantRole: m.role,
            person: {
              standardGivenName: m.name.split(' ')[0],
              standardFamilyName: m.name.split(' ').slice(1).join(' ') || 'Staff',
              biographicalInformation: {
                teamAttributes: [{ teamName: m.teamName }],
              },
            },
          }));
          dev.factory.tournamentEngine.addParticipants({ participants: staffParticipants });
        }

        const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        await dev.tmx2db.addTournament(mutated);

        return {
          tournamentId: tournamentRecord.tournamentId as string,
          teamNames: teamNames as [string, string],
          teamIds,
        };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | inner: ${err?.inner?.message || err?.cause?.message || ''} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { teamNames, playersPerTeam, staff: opts.staff },
  );
}

/** Round robin tournament for tally/standings testing */
export const PROFILE_ROUND_ROBIN: MockProfile = {
  tournamentName: 'E2E Round Robin',
  tournamentAttributes: { tournamentId: 'e2e-round-robin' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [
    {
      eventName: 'RR Singles',
      drawSize: 16,
      drawType: 'ROUND_ROBIN',
    },
  ],
};
