import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 132 — clicking a scheduling issue points at the GRID cell.
 *
 * The Issues popover under the court grid exists to answer one question: *where is
 * the problem?* Clicking a row scrolls that matchUp into view and pulses it.
 *
 * It was pointing at the wrong copy. `scrollToMatchUp` resolved its target with a
 * bare `document.querySelector('.spl-grid-cell[data-matchup-id="…"]')`, and that
 * selector is **not unique**: the active strip above the grid draws a second cell of
 * the same class for every scheduled matchUp that is not complete, and it comes
 * FIRST in document order. So the click scrolled to a sticky band already on screen
 * and pulsed the strip copy, while the grid cell the operator was being sent to
 * could stay off screen entirely.
 *
 * That is not a rare shape for this panel. Scheduling conflicts are overwhelmingly
 * about matches still to be played — precisely the set the strip draws. Every issue
 * click on a live tournament hit it.
 *
 * ── What makes this journey a falsifier rather than a restatement ──
 *
 * Two assertions, and the second is the one that fails on the old code: the grid
 * cell must carry the pulse, and **no strip cell may**. Without the second, the test
 * passes on an implementation that pulses everything with the same id. The premise —
 * that the conflicting matchUp really is drawn in BOTH places — is asserted first,
 * because if the strip were empty the bug could not manifest and the whole journey
 * would be green against the defect.
 *
 * The same document-order trap was found and fixed in `locateMatchUp.scrollTarget`
 * in #1502(TMX); this is the other site.
 */

const DATE = todayLocal();

const STRIP = '.spl-active-strip';
const ISSUES_BUTTON = 'button:has(i.fa-triangle-exclamation)';
/**
 * A clickable row in the Issues popover, addressed by its own attribute rather than
 * through `.tippy-content` — that class is on every tippy on the page, including the
 * hidden "Schedule" tab tooltip, so scoping through it is a strict-mode violation.
 * The row attribute is unique to this popover, which makes the tippy internals
 * irrelevant here.
 */
const ISSUE_ROW = '[data-issue-match-up-id]';
/** The pulse `scrollToMatchUp` paints. Self-clearing on `animationend` (~1.5s). */
const PULSE = 'spl-cell--issue-pulse';

/** The court-grid copy of a cell — the grid's wrapper records where the matchUp was PLACED. */
const gridCell = (matchUpId: string) => `[data-court-order][data-matchup-id="${matchUpId}"] .spl-grid-cell`;
/** The active-strip copy of the same cell. */
const stripCell = (matchUpId: string) => `${STRIP} [data-matchup-id="${matchUpId}"]`;

/**
 * One individual entered in two events, with a matchUp from each scheduled onto
 * courtOrder 1 of two DIFFERENT courts at the same time — a same-row, cross-court
 * double-booking of the shared player, which `proConflicts` reports as a
 * participantConflict and the action bar surfaces in its Issues popover.
 *
 * Both matchUps are left TO_BE_PLAYED on purpose: an incomplete scheduled matchUp is
 * what the active strip draws, and the strip copy is the whole point of this journey.
 *
 * Seed shape copied from Journey 77, which establishes it as a real conflict.
 */
async function seedConflict(page: Page): Promise<{ tournamentId: string; matchUpIds: [string, string] }> {
  return page.evaluate(
    async ({ date }) => {
      try {
        await dev.tmx2db.initDB();
        const te = dev.factory.tournamentEngine;
        const ce = dev.factory.competitionEngine;

        dev.factory.mocksEngine.generateTournamentRecord({
          setState: true,
          nonRandom: 1,
          tournamentName: 'E2E Issue Scroll Target',
          tournamentAttributes: { tournamentId: 'e2e-issue-scroll', startDate: date, endDate: date },
          participantsProfile: { scaledParticipantsCount: 16 },
          drawProfiles: [{ eventName: 'IS Singles A', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
          venueProfiles: [{ courtsCount: 4, venueName: 'IS Venue' }],
        });

        const courts = te.getVenuesAndCourts().venues[0].courts;

        const aMatch = (ce.allTournamentMatchUps({}).matchUps || []).find(
          (m: any) => m.matchUpStatus !== 'BYE' && (m.sides || []).filter((s: any) => s.participantId).length === 2,
        );
        if (!aMatch) throw new Error('seed produced no fully-populated R1 matchUp');
        const pShared = aMatch.sides[0].participantId;
        const pOpp = aMatch.sides[1].participantId;

        const individuals = te.getParticipants({
          participantFilters: { participantTypes: ['INDIVIDUAL'] },
        }).participants;
        const pOther = individuals.find(
          (p: any) => p.participantId !== pShared && p.participantId !== pOpp,
        )?.participantId;
        if (!pOther) throw new Error('seed produced no third individual');

        const { event } = te.addEvent({ event: { eventName: 'IS Singles B', eventType: 'SINGLES' } });
        te.addEventEntries({ eventId: event.eventId, participantIds: [pShared, pOther] });
        const { drawDefinition } = te.generateDrawDefinition({ eventId: event.eventId, drawSize: 2, automated: true });
        te.addDrawDefinition({ eventId: event.eventId, drawDefinition });
        const bMatch = (drawDefinition.structures[0].matchUps || []).find((m: any) => m.roundNumber === 1);
        if (!bMatch) throw new Error('event B produced no round-1 matchUp');

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

        // The seed's own guard, re-read from the engine: without a real conflict the
        // Issues popover has no row to click and every assertion below is vacuous.
        const { matchUps } = ce.allCompetitionMatchUps({
          matchUpFilters: { scheduledDate: date },
          nextMatchUps: true,
          inContext: true,
        });
        const conflicts = (Object.values(ce.proConflicts({ matchUps })?.rowIssues ?? {}) as any[])
          .flat()
          .filter((issue: any) => issue?.issue === 'CONFLICT');
        if (!conflicts.length) throw new Error('seed produced no hard conflict');

        return {
          tournamentId: rec.tournamentId as string,
          matchUpIds: [aMatch.matchUpId, bMatch.matchUpId] as [string, string],
        };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: DATE },
  );
}

test.describe('Journey 132 — a scheduling issue points at the grid cell, not the active strip', () => {
  let tournamentId: string;
  let aId: string;
  let bId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());

    const seed = await seedConflict(page);
    tournamentId = seed.tournamentId;
    [aId, bId] = seed.matchUpIds;

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP, { timeout: 10_000 });
  });

  test('the conflicting matchUp is drawn in BOTH the grid and the strip — the premise', async ({ page }) => {
    // Without this the journey would pass against the defect whenever the strip
    // happened to be empty, which is exactly when the bug cannot fire.
    await expect(page.locator(gridCell(aId))).toHaveCount(1);
    await expect(page.locator(stripCell(aId)).first()).toBeVisible();
    // …and the two copies really are distinct elements carrying the same id.
    await expect(page.locator(`[data-matchup-id="${aId}"]`)).not.toHaveCount(1);
  });

  test('clicking the issue row pulses the grid cell and leaves the strip alone', async ({ page }) => {
    const issues = page.locator(ISSUES_BUTTON);
    await expect(issues).toBeVisible({ timeout: 8_000 });
    await issues.click();

    const row = page.locator(ISSUE_ROW).first();
    await expect(row).toBeVisible({ timeout: 5_000 });
    const targeted = await row.getAttribute('data-issue-match-up-id');
    expect([aId, bId]).toContain(targeted);

    await row.click();

    // The pulse lands on the court grid, which is where the operator was sent.
    await expect(page.locator(gridCell(targeted as string))).toHaveClass(new RegExp(PULSE));
    // The bug, stated as an assertion. The strip copy comes first in document
    // order, so before the fix this is where the pulse went — on a band that was
    // already on screen, while the grid cell stayed wherever it was.
    await expect(page.locator(`${STRIP} .${PULSE}`)).toHaveCount(0);
  });
});
