import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 77 — Schedule grid: resolve player conflicts (proColumnResolve)
 *
 * The resolve-conflicts toolbar action (fa-arrows-down-to-line, next to the
 * shift-courts button) re-lays the grid VERTICALLY to clear a cross-court
 * participant conflict WITHOUT changing any match's court or scheduledTime —
 * only courtOrder moves (a blank row is inserted so the two matches land on
 * different rows).
 *
 * Seed: one individual entered in two events, with a matchUp from each event
 * scheduled onto the SAME courtOrder on two DIFFERENT courts → the player is
 * double-booked at the same slot. (Cross-event, so it's a pure participant
 * conflict — a same-draw R1→R2 pairing would register as a matchUpConflict
 * ERROR instead, which the action deliberately does not treat as a player
 * conflict.)
 *
 * Assert: after clicking resolve + confirming, the participant conflict is
 * gone, both matches keep their court + scheduledTime, and they now sit on
 * different courtOrders. This is the client-side mirror of the factory-level
 * proColumnResolve test.
 */

const DATE = new Date().toISOString().slice(0, 10);
const STRIP_SELECTOR = '.spl-active-strip';
const RESOLVE_BUTTON = 'button:has(i.fa-arrows-down-to-line)';
const CONFLICT_TYPES = ['participantConflict', 'potentialParticipantConflict'];
// Severity value of SCHEDULE_CONFLICT — only HARD (same-row) conflicts count.
// After resolution the two matches land on adjacent rows, which proConflicts
// reports as a softer SCHEDULE_WARNING (back-to-back), NOT a conflict — the
// resolver deliberately clears conflicts, not warnings.
const CONFLICT_SEVERITY = 'CONFLICT';

/** Count HARD participant / potential-participant conflict cells for the seeded
 *  day — same proConflicts + severity filter the resolve handler uses. */
async function participantConflictCount(page: Page): Promise<number> {
  return page.evaluate(
    ({ date, types, severity }) => {
      const { matchUps } = dev.factory.competitionEngine.allCompetitionMatchUps({
        matchUpFilters: { scheduledDate: date },
        nextMatchUps: true,
        inContext: true,
      });
      const result = dev.factory.competitionEngine.proConflicts({ matchUps });
      return (Object.values(result?.rowIssues ?? {}) as any[])
        .flat()
        .filter((issue: any) => issue?.issue === severity && types.includes(issue?.issueType)).length;
    },
    { date: DATE, types: CONFLICT_TYPES, severity: CONFLICT_SEVERITY },
  );
}

async function readSchedule(page: Page, matchUpId: string) {
  return page.evaluate((id) => {
    const { matchUp } = dev.factory.tournamentEngine.findMatchUp({ matchUpId: id });
    const s: any = matchUp?.schedule ?? {};
    return {
      courtId: s.courtId ?? null,
      scheduledTime: s.scheduledTime ?? null,
      courtOrder: s.courtOrder ?? null,
    };
  }, matchUpId);
}

/** Seed two events sharing one individual, with a matchUp from each scheduled
 *  onto courtOrder 1 of two different courts (same time) — a same-row,
 *  cross-court double-booking of the shared player. One persist to avoid
 *  racing the fire-and-forget save. */
async function seedConflict(page: Page): Promise<{ tournamentId: string; matchUpIds: [string, string] }> {
  return page.evaluate(
    async ({ date }) => {
      await dev.tmx2db.initDB();
      const te = dev.factory.tournamentEngine;
      const ce = dev.factory.competitionEngine;

      dev.factory.mocksEngine.generateTournamentRecord({
        setState: true,
        nonRandom: 1,
        tournamentName: 'E2E Resolve Conflicts',
        tournamentAttributes: { tournamentId: 'e2e-resolve-conflicts', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'RC Singles A', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 4, venueName: 'RC Venue' }],
      });

      const courts = te.getVenuesAndCourts().venues[0].courts;

      // an R1 matchUp from draw A with two real participants
      const aMatch = (ce.allTournamentMatchUps({}).matchUps || []).find(
        (m: any) => m.matchUpStatus !== 'BYE' && (m.sides || []).filter((s: any) => s.participantId).length === 2,
      );
      const pShared = aMatch.sides[0].participantId;
      const pOpp = aMatch.sides[1].participantId;

      // a different individual to partner the shared player in event B
      const individuals = te.getParticipants({
        participantFilters: { participantTypes: ['INDIVIDUAL'] },
      }).participants;
      const pOther = individuals.find(
        (p: any) => p.participantId !== pShared && p.participantId !== pOpp,
      ).participantId;

      // event B (singles): pShared vs pOther → a matchUp that double-books pShared
      const { event } = te.addEvent({ event: { eventName: 'RC Singles B', eventType: 'SINGLES' } });
      te.addEventEntries({ eventId: event.eventId, participantIds: [pShared, pOther] });
      const { drawDefinition } = te.generateDrawDefinition({ eventId: event.eventId, drawSize: 2, automated: true });
      te.addDrawDefinition({ eventId: event.eventId, drawDefinition });
      // Raw drawDefinition matchUps carry drawPositions but not hydrated sides
      // (participants resolve from positionAssignments at query time), so select
      // the single round-1 matchUp by roundNumber — we only need its id + drawId.
      const bMatch = (drawDefinition.structures[0].matchUps || []).find((m: any) => m.roundNumber === 1);

      const place = (matchUpId: string, drawId: string, court: any) =>
        te.addMatchUpScheduleItems({
          matchUpId,
          drawId,
          schedule: {
            scheduledDate: date,
            courtId: court.courtId,
            venueId: court.venueId,
            courtOrder: 1,
            scheduledTime: '09:00',
          },
        });
      place(aMatch.matchUpId, aMatch.drawId, courts[0]);
      place(bMatch.matchUpId, drawDefinition.drawId, courts[1]);

      const rec = te.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(rec);
      return {
        tournamentId: rec.tournamentId as string,
        matchUpIds: [aMatch.matchUpId, bMatch.matchUpId] as [string, string],
      };
    },
    { date: DATE },
  );
}

test.describe('Journey 77 — Schedule grid resolve player conflicts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('resolve icon clears a cross-court player conflict without moving courts or times', async ({ page }) => {
    const { tournamentId, matchUpIds } = await seedConflict(page);
    const [aId, bId] = matchUpIds;

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    // the double-booking is present
    expect(await participantConflictCount(page)).toBeGreaterThan(0);

    const before = { a: await readSchedule(page, aId), b: await readSchedule(page, bId) };

    // click the resolve icon, then confirm
    const resolveBtn = page.locator(RESOLVE_BUTTON);
    await expect(resolveBtn).toBeVisible({ timeout: 8_000 });
    await resolveBtn.click();
    await expect(page.getByText('Resolve player conflicts?')).toBeVisible({ timeout: 5_000 });
    await page.locator('button', { hasText: 'Ok' }).first().click();

    // hard conflict cleared (a soft back-to-back WARNING may remain — expected)
    await expect.poll(() => participantConflictCount(page), { timeout: 10_000 }).toBe(0);

    // invariants: courts + scheduledTimes unchanged; now on different rows
    const after = { a: await readSchedule(page, aId), b: await readSchedule(page, bId) };
    expect(after.a.courtId).toBe(before.a.courtId);
    expect(after.b.courtId).toBe(before.b.courtId);
    expect(after.a.scheduledTime).toBe(before.a.scheduledTime);
    expect(after.b.scheduledTime).toBe(before.b.scheduledTime);
    expect(after.a.courtOrder).not.toBe(after.b.courtOrder);
  });
});
