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
