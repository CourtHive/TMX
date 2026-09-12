import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 122 — a rest row drives the court-grid search.
 *
 * The rest section answers "how long have these players had off". The question
 * it immediately raises is "when DID they play?", and until now answering it
 * meant reading the name off the row and retyping it into the search box. A
 * click does it instead: the box is filled and every cell that player appears in
 * on the viewed day lights up.
 *
 * None of this has unit coverage and none of it can: the whole feature is a
 * click handler, a `dataset` read, a cross-module registry and a class toggle on
 * rendered cells, and TMX runs vitest without a DOM. The matcher underneath is
 * unit-tested (`gridSearchMatch.test.ts`); this journey is the only evidence the
 * wiring exists.
 *
 * ── The double space is deliberate ──
 *
 * One semifinalist is stored as `'Alex  Rivera'`. That is not a typo in this
 * file — it is the defect that produced the feature request. A trailing space
 * left in a first-name field composes a participantName with an interior double
 * space; HTML collapses it when painting, so the grid reads "Alex Rivera" and
 * nothing looks wrong, and then a search for "Alex Rivera" matched nothing while
 * "Alex" matched fine. The write boundaries are fixed now (the participant form
 * and the factory's addParticipant/modifyParticipant both normalize), but
 * records already carrying it must stay findable, so the seed writes the name
 * straight into the record — past the mutation that would now clean it — to
 * stand for the data that already exists.
 */

const SCHEDULE_DATE = todayLocal();

const INSPECTOR = '[data-panel="inspector"]';
const CATALOG_PANEL = '[data-panel="catalog"]';
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';
const CARD = '.spl-matchup-card';
const REST_ROW = '.tmx-rest-row';
const SEARCH_INPUT = 'input[data-grid-search="true"]';
const HIGHLIGHT = 'sch2-search-highlight';

/** The stored name, with the interior double space the whole feature trips over. */
const STORED_NAME = 'Alex  Rivera';
/** The same name as it is READ on screen, where the browser has collapsed the run. */
const DISPLAYED_NAME = 'Alex Rivera';

type Seed = {
  tournamentId: string;
  finalMatchUpId: string;
  /** The semifinal the double-spaced player won — must be highlighted. */
  ownSemiMatchUpId: string;
  /** The other semifinal — the control; must NOT be highlighted. */
  otherSemiMatchUpId: string;
};

/**
 * A 4-draw single elimination with both semifinals COMPLETED and on court
 * today, and the final left unscheduled — the exact moment the rest section is
 * for, when the director is deciding whether to call the next match.
 *
 * The winner of semifinal 1 is renamed to the double-spaced form after the draw
 * is built, so the name reaches the grid cell, the catalog card and the rest row
 * by the ordinary read path rather than being special-cased anywhere.
 *
 * Throws rather than falling back at every step: a seed that quietly produced no
 * completed semifinal would leave the central assertion checking an empty rest
 * section and passing.
 */
async function seedSemifinalsPlayed(page: import('@playwright/test').Page): Promise<Seed> {
  return page.evaluate(
    async ({ date, storedName }) => {
      try {
        await dev.tmx2db.initDB();

        dev.factory.mocksEngine.generateTournamentRecord({
          nonRandom: 1,
          setState: true,
          tournamentName: 'E2E Rest Row Search',
          tournamentAttributes: { tournamentId: 'e2e-rest-row-search', startDate: date, endDate: date },
          drawProfiles: [
            {
              eventName: 'Singles',
              drawSize: 4,
              drawType: 'SINGLE_ELIMINATION',
              outcomes: [
                { roundNumber: 1, roundPosition: 1, winningSide: 1, scoreString: '6-1 6-1' },
                { roundNumber: 1, roundPosition: 2, winningSide: 1, scoreString: '6-2 6-2' },
              ],
            },
          ],
          venueProfiles: [{ courtsCount: 2, venueName: 'Rest Venue' }],
        });

        const allMatchUps = () =>
          dev.factory.competitionEngine.allTournamentMatchUps({ inContext: true }).matchUps || [];

        const semis = allMatchUps()
          .filter((m: any) => m.roundNumber === 1 && m.matchUpStatus === 'COMPLETED')
          .sort((a: any, b: any) => a.roundPosition - b.roundPosition);
        if (semis.length !== 2) throw new Error(`expected 2 completed semifinals, got ${semis.length}`);

        const final = allMatchUps().find((m: any) => m.roundNumber === 2);
        if (!final) throw new Error('seed produced no final');

        const { venues } = dev.factory.tournamentEngine.getVenuesAndCourts();
        const venue = venues?.[0];
        if (!venue?.courts?.length) throw new Error('seed produced no courts');

        // Both semifinals on court today at different times; the final stays
        // unscheduled so it is selectable from the unscheduled catalog.
        semis.forEach((semi: any, index: number) => {
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: semi.matchUpId,
            drawId: semi.drawId,
            schedule: {
              scheduledDate: date,
              scheduledTime: index === 0 ? '10:00' : '11:00',
              venueId: venue.venueId,
              courtId: venue.courts[index].courtId,
              courtOrder: 1,
            },
          });
        });

        // The winner of semifinal 1 — the player who must appear on a rest row
        // under the final, and whose own semifinal must light up when it is
        // clicked. Renamed straight on the record, past addParticipant, because
        // addParticipant now normalizes this away.
        const winnerId = semis[0].sides.find((s: any) => s.sideNumber === semis[0].winningSide)?.participantId;
        if (!winnerId) throw new Error('semifinal 1 has no identified winner');

        const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        const winner = (record.participants || []).find((p: any) => p.participantId === winnerId);
        if (!winner) throw new Error('winning participant not found on the record');
        winner.participantName = storedName;
        winner.person = { ...(winner.person || {}), standardGivenName: 'Alex ', standardFamilyName: 'Rivera' };

        // `getTournament()` hands back a COPY, so the edit above has changed nothing
        // the engine knows about. Feeding it back through setState is what makes the
        // renamed record the one TMX reads — writing it only to IndexedDB left the
        // in-memory engine serving the original names, and the rest rows showed them.
        dev.factory.tournamentEngine.setState(record);
        await dev.tmx2db.addTournament(record);

        // The seed's own guard. Every assertion in this journey is about a name
        // with a double space in it; if the rename silently failed the rows would
        // still render, just with the mock names, and the filters would quietly
        // find nothing. Re-read it from the engine rather than trusting the write.
        const reread = (dev.factory.tournamentEngine.getTournament().tournamentRecord.participants || []).find(
          (p: any) => p.participantId === winnerId,
        );
        if (reread?.participantName !== storedName) {
          throw new Error(`rename did not take: participantName is ${JSON.stringify(reread?.participantName)}`);
        }

        return {
          tournamentId: record.tournamentId as string,
          finalMatchUpId: final.matchUpId as string,
          ownSemiMatchUpId: semis[0].matchUpId as string,
          otherSemiMatchUpId: semis[1].matchUpId as string,
        };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: SCHEDULE_DATE, storedName: STORED_NAME },
  );
}

test.describe('Journey 122 — an Inspector rest row drives the court-grid search', () => {
  let seed: Seed;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
    seed = await seedSemifinalsPlayed(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(UNSCHEDULED_TAB).click();
    await page.locator(CATALOG_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator(`${CARD}[data-matchup-id="${seed.finalMatchUpId}"]`).click();
    await page.locator(`${INSPECTOR} ${REST_ROW}`).first().waitFor({ state: 'visible', timeout: 10_000 });
  });

  test('the stored double space is invisible on screen — which is how it hid', async ({ page }) => {
    // Not decoration: this is the premise the rest of the journey rests on. If
    // the browser did NOT collapse the run, the old search would have looked
    // broken immediately and none of this would have been a mystery.
    const row = page.locator(`${INSPECTOR} ${REST_ROW}`).filter({ hasText: DISPLAYED_NAME });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.tmx-rest-name')).toHaveText(DISPLAYED_NAME);
    // …and the record underneath really does carry the double space.
    expect(await row.getAttribute('data-participant-name')).toBe(STORED_NAME);
  });

  test('clicking a rest row fills the search box and highlights that player only', async ({ page }) => {
    const own = page.locator(`.spl-grid-cell[data-matchup-id="${seed.ownSemiMatchUpId}"]`);
    const other = page.locator(`.spl-grid-cell[data-matchup-id="${seed.otherSemiMatchUpId}"]`);

    await own.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(own).not.toHaveClass(new RegExp(HIGHLIGHT));

    await page.locator(`${INSPECTOR} ${REST_ROW}`).filter({ hasText: DISPLAYED_NAME }).click();

    await expect(page.locator(SEARCH_INPUT)).toHaveValue(STORED_NAME);
    // The bug, stated as an assertion: a stored 'Alex  Rivera' must match.
    await expect(own).toHaveClass(new RegExp(HIGHLIGHT));
    // The control — without it this passes on a search that highlights everything.
    await expect(other).not.toHaveClass(new RegExp(HIGHLIGHT));
  });

  test('typing the displayed name matches the double-spaced record', async ({ page }) => {
    // The operator's own path to the same place, and the one that was broken:
    // 'Alex' found the cell and 'Alex Rivera' did not.
    const own = page.locator(`.spl-grid-cell[data-matchup-id="${seed.ownSemiMatchUpId}"]`);
    await own.waitFor({ state: 'visible', timeout: 10_000 });

    await page.locator(SEARCH_INPUT).fill(DISPLAYED_NAME);
    await expect(own).toHaveClass(new RegExp(HIGHLIGHT));
  });

  test('a rest row is reachable and actionable from the keyboard', async ({ page }) => {
    const row = page.locator(`${INSPECTOR} ${REST_ROW}`).filter({ hasText: DISPLAYED_NAME });
    await expect(row).toHaveAttribute('role', 'button');

    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(SEARCH_INPUT)).toHaveValue(STORED_NAME);
  });

  test('no unresolved i18n key reaches the operator', async ({ page }) => {
    const row = page.locator(`${INSPECTOR} ${REST_ROW}`).first();
    const label = (await row.getAttribute('aria-label')) ?? '';
    expect(label).not.toBe('');
    // `t()` echoes its key when it resolves to nothing; a dotted path is the signature.
    expect(label).not.toMatch(/schedule\.inspector\.rest/);
    expect(label).not.toContain('{{');
  });
});
