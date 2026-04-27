import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_EMPTY_TOURNAMENT, PROFILE_WITH_VENUES } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 25 — Venue court naming and rename
 *
 * Validates two fixes:
 * 1. Courts default to "Court N" naming (not venue abbreviation) when no
 *    courtNameBase is provided — tests the mutation parameter path that
 *    addVenue.ts and venueRowFormatter.ts use.
 * 2. Court rename via modifyCourt updates factory state immediately.
 */

test.describe('Journey 25 — Venue court naming and rename', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('addCourts without courtNameBase defaults to "Court N" naming', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // Simulate the same mutation path as addVenue.ts: addVenue + addCourts
    // WITHOUT venueAbbreviationRoot — the factory default "Court" should be used
    const courts = await page.evaluate(() => {
      const { tools } = dev.factory;
      const venueId = tools.UUID();

      dev.factory.tournamentEngine.addVenue({
        venue: { venueName: 'Test Tennis Center', venueAbbreviation: 'TTC', venueId },
      });

      dev.factory.tournamentEngine.addCourts({
        courtsCount: 3,
        venueId,
        // No courtNameRoot, no venueAbbreviationRoot — factory defaults to "Court"
      });

      const { venue } = dev.factory.tournamentEngine.findVenue({ venueId });
      return venue.courts.map((c: any) => c.courtName);
    });

    expect(courts).toHaveLength(3);
    expect(courts).toEqual(['Court 1', 'Court 2', 'Court 3']);
  });

  test('addCourts with venueAbbreviationRoot names courts using abbreviation', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // This is the OLD behavior that the fix removed — verify it still works
    // if someone explicitly passes venueAbbreviationRoot
    const courts = await page.evaluate(() => {
      const { tools } = dev.factory;
      const venueId = tools.UUID();

      dev.factory.tournamentEngine.addVenue({
        venue: { venueName: 'Abbreviation Venue', venueAbbreviation: 'ABV', venueId },
      });

      dev.factory.tournamentEngine.addCourts({
        venueAbbreviationRoot: true,
        courtsCount: 2,
        venueId,
      });

      const { venue } = dev.factory.tournamentEngine.findVenue({ venueId });
      return venue.courts.map((c: any) => c.courtName);
    });

    expect(courts).toHaveLength(2);
    expect(courts).toEqual(['ABV 1', 'ABV 2']);
  });

  test('addCourts with courtNameRoot uses the custom root', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    const courts = await page.evaluate(() => {
      const { tools } = dev.factory;
      const venueId = tools.UUID();

      dev.factory.tournamentEngine.addVenue({
        venue: { venueName: 'Grand Slam Arena', venueAbbreviation: 'GSA', venueId },
      });

      dev.factory.tournamentEngine.addCourts({
        courtNameRoot: 'Centre Court',
        courtsCount: 2,
        venueId,
      });

      const { venue } = dev.factory.tournamentEngine.findVenue({ venueId });
      return venue.courts.map((c: any) => c.courtName);
    });

    expect(courts).toHaveLength(2);
    expect(courts).toEqual(['Centre Court 1', 'Centre Court 2']);
  });

  test('seeded venue courts use "Court N" naming', async ({ page }) => {
    await seedTournament(page, PROFILE_WITH_VENUES);

    const courts = await page.evaluate(() => {
      const venues = dev.factory.tournamentEngine.getVenuesAndCourts()?.venues || [];
      return venues.flatMap((v: any) => v.courts || []).map((c: any) => c.courtName);
    });

    expect(courts.length).toBeGreaterThan(0);
    for (const name of courts) {
      expect(name).toMatch(/^Court \d+$/);
    }
  });

  test('modifyCourt updates courtName in factory state immediately', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_WITH_VENUES);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // Get a court to rename
    const courtsBefore = await page.evaluate(() => {
      const venues = dev.factory.tournamentEngine.getVenuesAndCourts()?.venues || [];
      return venues.flatMap((v: any) => v.courts || []).map((c: any) => ({
        courtId: c.courtId,
        courtName: c.courtName,
      }));
    });

    expect(courtsBefore.length).toBeGreaterThan(0);
    const target = courtsBefore[0];

    // Rename via the same mutation path as renameCourt.ts
    const result = await page.evaluate(
      ({ courtId, newName }) => {
        return dev.factory.tournamentEngine.modifyCourt({
          courtId,
          modifications: { courtName: newName },
        });
      },
      { courtId: target.courtId, newName: 'Show Court' },
    );

    expect(result.success).toBe(true);

    // Verify the rename is immediately visible in factory state (no refresh)
    const courtsAfter = await page.evaluate(() => {
      const venues = dev.factory.tournamentEngine.getVenuesAndCourts()?.venues || [];
      return venues.flatMap((v: any) => v.courts || []).map((c: any) => c.courtName);
    });

    expect(courtsAfter).toContain('Show Court');
    expect(courtsAfter).not.toContain(target.courtName);
  });

  test('schedule courtsData reflects court names correctly', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_WITH_VENUES);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // Get courtsData from the schedule query — this is what the schedule grid displays
    const courtNames = await page.evaluate(() => {
      const result = dev.factory.competitionEngine.competitionScheduleMatchUps({});
      return (result.courtsData || []).map((c: any) => c.courtName);
    });

    expect(courtNames.length).toBeGreaterThan(0);
    for (const name of courtNames) {
      expect(name).toMatch(/^Court \d+$/);
    }
  });
});
