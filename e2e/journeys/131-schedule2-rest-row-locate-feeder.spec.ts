import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 131 — a pending rest row points at the match that decides it.
 *
 * The rest section lists one row per side of the selected matchUp, and the two
 * kinds of row mean different things. A row for a **person** was already
 * clickable (Journey 122): it drives the grid search and lights up every cell that
 * player appears in. A row for an **undecided side** — `Winner of R16: Brik/Michel
 * vs Carrasco/De L' Herbe` — was deliberately inert, because its name is a matchUp
 * label and handing that to a name search highlights nothing while looking like it
 * should.
 *
 * So the one question such a row raises — *which match decides this side?* — was
 * the one question the panel could not answer by pointing, even though the row was
 * built from that very matchUp and the grid already draws it under
 * `data-matchup-id`. This journey is the evidence that it now can.
 *
 * ── Why a journey and not a unit test ──
 *
 * The rule underneath is unit-tested (`restRowActivation.test.ts`, including the
 * control that a person's row must NOT locate even though it carries a
 * `fromMatchUpId` too). Everything above it is a click handler, a `dataset` read, a
 * cross-module registration and a class toggle on cells rendered by another
 * package — and TMX runs vitest without a DOM. This is the only evidence the wiring
 * exists.
 *
 * ── Why the pointer is parked before the pre-state is read ──
 *
 * Hovering a catalog card ALREADY highlights its related matchUps, and a rest
 * row's `fromMatchUpId` is one of the relations that feeds that set — so both
 * semifinals are lit while the pointer rests on the final's card, which is exactly
 * where `.click()` leaves it. Reading "not highlighted" without moving away first
 * would be reading the card hover, and the assertion that the row's click did the
 * work would pass on a feature that does nothing.
 */

const SCHEDULE_DATE = todayLocal();

const INSPECTOR = '[data-panel="inspector"]';
const CATALOG_PANEL = '[data-panel="catalog"]';
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';
const CARD = '.spl-matchup-card';
const REST_ROW = '.tmx-rest-row';
const PENDING_ROW = '.tmx-rest-row[data-pending-upstream="true"]';
const PERSON_ROW = '.tmx-rest-row.is-searchable';
const SEARCH_INPUT = 'input[data-grid-search="true"]';

/** The benign "waiting on / just came out of" paint — deliberately not the amber conflict one. */
const RELATED = 'spl-related-highlight';
/** The grid-search paint, which a pending row must never trigger. */
const SEARCH_HIGHLIGHT = 'sch2-search-highlight';

/**
 * The COURT-GRID copy of a cell.
 *
 * `.spl-grid-cell[data-matchup-id=…]` is not unique: the active strip above the grid
 * draws a second cell of the same class for anything due or on court, so a bare
 * selector matched twice here and failed Playwright's strict mode. The grid's own
 * wrapper is the one that records where the matchUp was PLACED, so `data-court-order`
 * tells the two apart — the strip cell's wrapper carries a court and a row index and
 * no matchUp at all.
 *
 * Journey 122 never met this because both of its semifinals are complete, and a
 * complete matchUp is not in the strip.
 */
const gridCell = (matchUpId: string) => `[data-court-order][data-matchup-id="${matchUpId}"] .spl-grid-cell`;

/** The active-strip copy of the same cell. Highlighted too — the paint is per surface-agnostic id. */
const stripCell = (matchUpId: string) => `.spl-active-strip [data-matchup-id="${matchUpId}"]`;

type Seed = {
  tournamentId: string;
  /** Unscheduled, one side decided and one side still being played for. */
  finalMatchUpId: string;
  /** COMPLETED and on court — the decided side's person row points here. */
  playedSemiMatchUpId: string;
  /** Scheduled, NOT complete — the pending row must point here and only here. */
  pendingSemiMatchUpId: string;
};

/**
 * A 4-draw single elimination with ONE semifinal played and the other still to
 * come, both on court today, and the final left unscheduled.
 *
 * That asymmetry is the whole point: the final then carries exactly one row of each
 * kind — a person row for the winner who is already through, and a pending row for
 * the side that is still being decided — so one selection exercises both gestures
 * and each is the other's control.
 *
 * Throws at every step rather than falling back. A seed that quietly produced no
 * pending row would leave the central assertions checking an empty rest section
 * and passing.
 */
async function seedOneSemiPlayed(page: import('@playwright/test').Page): Promise<Seed> {
  return page.evaluate(
    async ({ date }) => {
      try {
        await dev.tmx2db.initDB();

        dev.factory.mocksEngine.generateTournamentRecord({
          nonRandom: 1,
          setState: true,
          tournamentName: 'E2E Rest Row Locate Feeder',
          tournamentAttributes: { tournamentId: 'e2e-rest-row-locate', startDate: date, endDate: date },
          drawProfiles: [
            {
              eventName: 'Singles',
              drawSize: 4,
              drawType: 'SINGLE_ELIMINATION',
              // Only roundPosition 1 is played. roundPosition 2 stays incomplete,
              // which is what gives the final an undecided side.
              outcomes: [{ roundNumber: 1, roundPosition: 1, winningSide: 1, scoreString: '6-1 6-1' }],
            },
          ],
          venueProfiles: [{ courtsCount: 2, venueName: 'Locate Venue' }],
        });

        const allMatchUps = () =>
          dev.factory.competitionEngine.allTournamentMatchUps({ inContext: true }).matchUps || [];

        const semis = allMatchUps()
          .filter((m: any) => m.roundNumber === 1)
          .sort((a: any, b: any) => a.roundPosition - b.roundPosition);
        if (semis.length !== 2) throw new Error(`expected 2 semifinals, got ${semis.length}`);

        const played = semis[0];
        const pending = semis[1];
        if (played.matchUpStatus !== 'COMPLETED') {
          throw new Error(`semifinal 1 should be COMPLETED, is ${played.matchUpStatus}`);
        }
        if (pending.matchUpStatus === 'COMPLETED') throw new Error('semifinal 2 should NOT be complete');

        const final = allMatchUps().find((m: any) => m.roundNumber === 2);
        if (!final) throw new Error('seed produced no final');

        const { venues } = dev.factory.tournamentEngine.getVenuesAndCourts();
        const venue = venues?.[0];
        if ((venue?.courts?.length ?? 0) < 2) throw new Error('seed produced fewer than 2 courts');

        // Both semifinals on court today, on different courts at different times.
        // The played one earlier, so the person row has a real rest interval to
        // measure; the pending one later, so it is still ahead of the clock.
        [played, pending].forEach((semi: any, index: number) => {
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: semi.matchUpId,
            drawId: semi.drawId,
            schedule: {
              scheduledDate: date,
              scheduledTime: index === 0 ? '09:00' : '10:00',
              venueId: venue.venueId,
              courtId: venue.courts[index].courtId,
              courtOrder: 1,
            },
          });
        });

        const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        await dev.tmx2db.addTournament(record);

        // The seed's own guard, re-read from the engine rather than trusted: the
        // final must have exactly ONE decided side. Two, and there is no pending
        // row; none, and there is no person row — either way every assertion below
        // would be checking the wrong thing while still passing.
        const reread = dev.factory.competitionEngine
          .allTournamentMatchUps({ inContext: true })
          .matchUps.find((m: any) => m.matchUpId === final.matchUpId);
        const decided = (reread?.sides || []).filter(
          (side: any) => side.participantId || side.participant?.participantId,
        );
        if (decided.length !== 1) {
          throw new Error(`final should have exactly 1 decided side, has ${decided.length}`);
        }

        return {
          tournamentId: record.tournamentId as string,
          finalMatchUpId: final.matchUpId as string,
          playedSemiMatchUpId: played.matchUpId as string,
          pendingSemiMatchUpId: pending.matchUpId as string,
        };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: SCHEDULE_DATE },
  );
}

test.describe('Journey 131 — a pending rest row points at the matchUp that decides the side', () => {
  let seed: Seed;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
    seed = await seedOneSemiPlayed(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(UNSCHEDULED_TAB).click();
    await page.locator(CATALOG_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator(`${CARD}[data-matchup-id="${seed.finalMatchUpId}"]`).click();
    await page.locator(`${INSPECTOR} ${REST_ROW}`).first().waitFor({ state: 'visible', timeout: 10_000 });

    // Park the pointer off the card so its hover highlight is released. See the
    // file header — without this, every "not highlighted" assertion below reads
    // the card hover instead of the feature.
    await page.mouse.move(0, 0);
  });

  test('the final carries one row of each kind, and only the pending one is locatable', async ({ page }) => {
    // The premise. Both later tests use each row as the other's control, so a
    // selection that produced two rows of the same kind would make them vacuous.
    await expect(page.locator(`${INSPECTOR} ${PENDING_ROW}`)).toHaveCount(1);
    await expect(page.locator(`${INSPECTOR} ${PERSON_ROW}`)).toHaveCount(1);

    const pending = page.locator(`${INSPECTOR} ${PENDING_ROW}`);
    await expect(pending).toHaveClass(/is-locatable/);
    await expect(pending).not.toHaveClass(/is-searchable/);
    await expect(pending).toHaveAttribute('role', 'button');
    // It points at the unfinished semifinal — by id, not by the label it prints.
    await expect(pending).toHaveAttribute('data-locate-match-up-id', seed.pendingSemiMatchUpId);
    // …and it reads as the matchUp it is, rather than as a player.
    await expect(pending.locator('.tmx-rest-name')).toContainText('Winner of');
  });

  test('clicking the pending row highlights its feeder on the grid, and nothing else', async ({ page }) => {
    const feeder = page.locator(gridCell(seed.pendingSemiMatchUpId));
    const other = page.locator(gridCell(seed.playedSemiMatchUpId));

    await feeder.waitFor({ state: 'visible', timeout: 10_000 });
    // The pre-state, read with the pointer parked. This is the gap being closed:
    // before the change the click below left this exactly as it is here.
    await expect(feeder).not.toHaveClass(new RegExp(RELATED));

    await page.locator(`${INSPECTOR} ${PENDING_ROW}`).click();

    await expect(feeder).toHaveClass(new RegExp(RELATED));
    // The control — without it this passes on a click that highlights the whole day.
    await expect(other).not.toHaveClass(new RegExp(RELATED));
    // The strip copy lights up as well, and that is the intent rather than a leak:
    // the paint is keyed on the matchUp id wherever the page draws it, and an
    // operator reading the due band should see the same answer as one reading the grid.
    await expect(page.locator(stripCell(seed.pendingSemiMatchUpId)).first()).toHaveClass(new RegExp(RELATED));
  });

  test('a pending row does NOT drive the grid search — its name is a matchUp, not a player', async ({ page }) => {
    // The defect the feature had to avoid rather than the one it fixes: the row's
    // `participantName` is populated with a matchUp label, so wiring it to the
    // search box would have filled the box with a string no cell carries and
    // highlighted nothing.
    const search = page.locator(SEARCH_INPUT);
    await expect(search).toHaveValue('');

    await page.locator(`${INSPECTOR} ${PENDING_ROW}`).click();

    await expect(search).toHaveValue('');
    await expect(page.locator(`.${SEARCH_HIGHLIGHT}`)).toHaveCount(0);
  });

  test('a person row still drives the search — the two gestures did not get crossed', async ({ page }) => {
    // The regression control for the row kind that already worked. The decision
    // moved into a shared function, so the person path has to be re-proved here.
    const row = page.locator(`${INSPECTOR} ${PERSON_ROW}`);
    const name = await row.getAttribute('data-participant-name');
    expect(name).toBeTruthy();

    await row.click();

    await expect(page.locator(SEARCH_INPUT)).toHaveValue(name as string);
    await expect(page.locator(gridCell(seed.playedSemiMatchUpId))).toHaveClass(new RegExp(SEARCH_HIGHLIGHT));
  });

  test('a pending row is reachable and actionable from the keyboard', async ({ page }) => {
    const feeder = page.locator(gridCell(seed.pendingSemiMatchUpId));
    await feeder.waitFor({ state: 'visible', timeout: 10_000 });

    const row = page.locator(`${INSPECTOR} ${PENDING_ROW}`);
    await row.focus();
    await page.keyboard.press('Enter');

    await expect(feeder).toHaveClass(new RegExp(RELATED));
  });

  test('no unresolved i18n key reaches the operator on a pending row', async ({ page }) => {
    const label = (await page.locator(`${INSPECTOR} ${PENDING_ROW}`).getAttribute('aria-label')) ?? '';
    expect(label).not.toBe('');
    // `t()` echoes its key when it resolves to nothing; a dotted path is the signature.
    expect(label).not.toMatch(/schedule\.inspector\.rest/);
    expect(label).not.toContain('{{');
  });
});
