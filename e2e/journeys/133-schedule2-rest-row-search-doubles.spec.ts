import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 133 — a rest row finds every cell a player is in, including DOUBLES.
 *
 * Journey 122 proved the rest row drives the court-grid search. It proved it on a
 * singles-only draw, and singles is the case that worked: the cell prints the
 * player's whole name, so matching the row's label against the cell's text found
 * it.
 *
 * A player entered in BOTH singles and doubles was never found in doubles, and
 * nobody noticed for as long as the feature existed. The row is labelled from the
 * player's SINGLES side — `John Michael Nearing` — while the doubles cell prints
 * the PAIR participant's own name, which the factory composes from FAMILY NAMES
 * ALONE: `Jensen/Nearing`. Clicking the row put the full name in the box, lit his
 * singles cell, silently skipped his doubles cell, and read as a player with no
 * doubles matches — so the daily-load figure on the row and the cells it pointed
 * at disagreed. Reported from a prod tournament under audit, 2026-09-27.
 *
 * The fix stops matching text and starts matching identity
 * (`gridSearchIndex.ts`), whose rules are unit-tested. What cannot be unit-tested
 * is that the index is wired to the paint: TMX runs vitest without a DOM, so this
 * journey is the only evidence.
 *
 * ── Why the row is located by data-participant-id, not by its text ──
 *
 * The row's label is `matchUpReadiness.nameFor()`'s answer, and what it is called is
 * not what this journey is about — the click resolves an IDENTITY, and
 * `data-participant-id` is that identity. Anchoring there keeps the journey pointed
 * at the behaviour under test rather than at a label a display config could change.
 *
 * It mattered more than style when this was written: `nameFor` labelled a pair
 * member from the first SIDE it found them on, so a player in two events was named
 * from whichever event `allTournamentMatchUps` returned first — their own name from
 * the singles side, their pair's from the doubles side. That is fixed in the same
 * arc as this journey (`nameFor` now returns the member's own name), so the label is
 * deterministic today. The id is still the honest anchor.
 *
 * ── Why the premise is asserted ──
 *
 * `the doubles cell does not contain the full name` is what the whole defect rests
 * on. If a future display config ever put given names in doubles cells, the text
 * path would start finding them unaided and every remaining assertion here would
 * pass whether or not the index existed.
 */

const SCHEDULE_DATE = todayLocal();

const INSPECTOR = '[data-panel="inspector"]';
const CATALOG_PANEL = '[data-panel="catalog"]';
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';
const CARD = '.spl-matchup-card';
const REST_ROW = '.tmx-rest-row';
const SEARCH_INPUT = 'input[data-grid-search="true"]';
const HIGHLIGHT = 'sch2-search-highlight';

type Seed = {
  tournamentId: string;
  /** The singles final — unscheduled, so it is selectable from the catalog. */
  finalMatchUpId: string;
  /** The player, who is entered in both events. */
  playerId: string;
  /** Their full name, as a singles side prints it. */
  playerName: string;
  /** Their DOUBLES pair's composed name, as that cell prints it: `Jensen/Nearing`. */
  pairName: string;
  /** Their singles semifinal, on court today — must be highlighted. */
  singlesMatchUpId: string;
  /** Their doubles matchUp, on court today — the one that used to be missed. */
  doublesMatchUpId: string;
  /** A same-day cell they are in NO side of — the control; must NOT be highlighted. */
  controlMatchUpId: string;
};

/**
 * A singles draw and a doubles draw, both with round 1 played, sharing players —
 * which mocksEngine does by default: 4 of 8 individuals land in both events.
 *
 * Every step throws rather than falling back. A seed that quietly produced no
 * cross-event player, or a pair name that happened to carry a given name, would
 * leave the central assertion checking nothing and passing.
 */
async function seedCrossEventPlayer(page: import('@playwright/test').Page): Promise<Seed> {
  return page.evaluate(
    async ({ date }) => {
      try {
        await dev.tmx2db.initDB();

        const outcomes = [
          { roundNumber: 1, roundPosition: 1, winningSide: 1, scoreString: '6-1 6-1' },
          { roundNumber: 1, roundPosition: 2, winningSide: 1, scoreString: '6-2 6-2' },
        ];

        dev.factory.mocksEngine.generateTournamentRecord({
          nonRandom: 1,
          setState: true,
          tournamentName: 'E2E Rest Row Search Doubles',
          tournamentAttributes: { tournamentId: 'e2e-rest-row-search-doubles', startDate: date, endDate: date },
          drawProfiles: [
            { eventName: 'Singles', drawSize: 4, drawType: 'SINGLE_ELIMINATION', outcomes },
            { eventName: 'Doubles', eventType: 'DOUBLES', drawSize: 4, drawType: 'SINGLE_ELIMINATION', outcomes },
          ],
          venueProfiles: [{ courtsCount: 3, venueName: 'Rest Venue' }],
        });

        const allMatchUps = () =>
          dev.factory.competitionEngine.allTournamentMatchUps({ inContext: true }).matchUps || [];

        /** Individual ids on a matchUp, pairs expanded to their members. */
        const individuals = (matchUp: any): string[] => {
          const ids: string[] = [];
          for (const side of matchUp.sides ?? []) {
            const members = side.participant?.individualParticipantIds ?? [];
            if (members.length) ids.push(...members);
            else {
              const own = side.participantId ?? side.participant?.participantId;
              if (own) ids.push(own);
            }
          }
          return ids;
        };

        const singlesSemis = allMatchUps()
          .filter((m: any) => m.matchUpType === 'SINGLES' && m.roundNumber === 1 && m.matchUpStatus === 'COMPLETED')
          .sort((a: any, b: any) => a.roundPosition - b.roundPosition);
        if (singlesSemis.length !== 2) {
          throw new Error(`expected 2 completed singles semifinals, got ${singlesSemis.length}`);
        }

        const singlesFinal = allMatchUps().find((m: any) => m.matchUpType === 'SINGLES' && m.roundNumber === 2);
        if (!singlesFinal) throw new Error('seed produced no singles final');

        // The player: whoever won singles semifinal 1, provided they are also in a
        // played doubles matchUp today. That overlap is the entire scenario.
        const playerId = singlesSemis[0].sides.find(
          (s: any) => s.sideNumber === singlesSemis[0].winningSide,
        )?.participantId;
        if (!playerId) throw new Error('singles semifinal 1 has no identified winner');

        const doubles = allMatchUps().find(
          (m: any) =>
            m.matchUpType === 'DOUBLES' && m.matchUpStatus === 'COMPLETED' && individuals(m).includes(playerId),
        );
        if (!doubles) throw new Error('the singles winner is in no completed doubles matchUp — no overlap to test');

        // The control must be a cell the player is in no side of.
        const control = singlesSemis[1];
        if (individuals(control).includes(playerId)) {
          throw new Error('the control matchUp contains the player — it would not control for anything');
        }

        const { venues } = dev.factory.tournamentEngine.getVenuesAndCourts();
        const venue = venues?.[0];
        if ((venue?.courts?.length ?? 0) < 3) throw new Error('seed produced fewer than 3 courts');

        // All three on court today, one per court. The singles final stays
        // unscheduled so it is selectable from the unscheduled catalog.
        [singlesSemis[0], doubles, control].forEach((matchUp: any, index: number) => {
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: matchUp.matchUpId,
            drawId: matchUp.drawId,
            schedule: {
              scheduledDate: date,
              scheduledTime: ['09:00', '10:00', '11:00'][index],
              venueId: venue.venueId,
              courtId: venue.courts[index].courtId,
              courtOrder: 1,
            },
          });
        });

        const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        const player = (record.participants || []).find((p: any) => p.participantId === playerId);
        const pair = (record.participants || []).find(
          (p: any) => p.participantType === 'PAIR' && p.individualParticipantIds?.includes(playerId),
        );
        if (!player?.participantName) throw new Error('player carries no participantName');
        if (!pair?.participantName) throw new Error('player is in no PAIR participant');

        // The premise, guarded in the seed as well as asserted on screen: the pair
        // name must not already carry the given name, or the old text search would
        // have found the doubles cell and there was never a defect to fix.
        const givenName = player.person?.standardGivenName;
        if (!givenName) throw new Error('player carries no standardGivenName');
        if (pair.participantName.includes(givenName)) {
          throw new Error(`pair name ${pair.participantName} carries the given name ${givenName} — nothing to test`);
        }

        await dev.tmx2db.addTournament(record);

        return {
          tournamentId: record.tournamentId as string,
          finalMatchUpId: singlesFinal.matchUpId as string,
          playerId: playerId as string,
          playerName: player.participantName as string,
          pairName: pair.participantName as string,
          singlesMatchUpId: singlesSemis[0].matchUpId as string,
          doublesMatchUpId: doubles.matchUpId as string,
          controlMatchUpId: control.matchUpId as string,
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

test.describe('Journey 133 — a rest row finds a player in doubles, not only in singles', () => {
  let seed: Seed;

  const cell = (page: import('@playwright/test').Page, matchUpId: string) =>
    page.locator(`.spl-grid-cell[data-matchup-id="${matchUpId}"]`);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
    seed = await seedCrossEventPlayer(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(UNSCHEDULED_TAB).click();
    await page.locator(CATALOG_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator(`${CARD}[data-matchup-id="${seed.finalMatchUpId}"]`).click();
    await page.locator(`${INSPECTOR} ${REST_ROW}`).first().waitFor({ state: 'visible', timeout: 10_000 });
  });

  test('the doubles cell carries family names only — which is how this hid', async ({ page }) => {
    const doubles = cell(page, seed.doublesMatchUpId);
    await doubles.waitFor({ state: 'visible', timeout: 10_000 });

    const cellText = (await doubles.innerText()).replace(/\s+/g, ' ');
    // The pair label IS there…
    expect(cellText).toContain(seed.pairName);
    // …and the name the rest row is labelled with is NOT, anywhere in the cell.
    // No text matcher could ever have connected the two.
    expect(cellText).not.toContain(seed.playerName);
  });

  test('clicking the rest row highlights the SINGLES and the DOUBLES cell', async ({ page }) => {
    const singles = cell(page, seed.singlesMatchUpId);
    const doubles = cell(page, seed.doublesMatchUpId);
    const control = cell(page, seed.controlMatchUpId);

    await singles.waitFor({ state: 'visible', timeout: 10_000 });
    await doubles.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(singles).not.toHaveClass(new RegExp(HIGHLIGHT));
    await expect(doubles).not.toHaveClass(new RegExp(HIGHLIGHT));

    await page.locator(`${INSPECTOR} ${REST_ROW}[data-participant-id="${seed.playerId}"]`).click();

    // This one always worked.
    await expect(singles).toHaveClass(new RegExp(HIGHLIGHT));
    // This is the defect, stated as an assertion.
    await expect(doubles).toHaveClass(new RegExp(HIGHLIGHT));
    // The control — without it this passes on a search that highlights everything.
    await expect(control).not.toHaveClass(new RegExp(HIGHLIGHT));
  });

  test('typing the full name finds the doubles cell too', async ({ page }) => {
    // The operator's own path to the same place. Identity matching is not reserved
    // for the click — it is how the box itself now resolves a name.
    const doubles = cell(page, seed.doublesMatchUpId);
    const control = cell(page, seed.controlMatchUpId);
    await doubles.waitFor({ state: 'visible', timeout: 10_000 });

    await page.locator(SEARCH_INPUT).fill(seed.playerName);

    await expect(doubles).toHaveClass(new RegExp(HIGHLIGHT));
    await expect(control).not.toHaveClass(new RegExp(HIGHLIGHT));
  });

  test('the pair name the cell displays still matches', async ({ page }) => {
    // Identity matching ADDS cells; it must not have cost the plain reading of
    // what is actually printed on screen.
    const doubles = cell(page, seed.doublesMatchUpId);
    await doubles.waitFor({ state: 'visible', timeout: 10_000 });

    await page.locator(SEARCH_INPUT).fill(seed.pairName);
    await expect(doubles).toHaveClass(new RegExp(HIGHLIGHT));
  });

  test('a family-name query finds both of that player’s cells', async ({ page }) => {
    // What an operator types when they are in a hurry, and the half the pair name
    // does carry. Token-prefix matching resolves it against the individual AND the
    // pair, so the singles cell comes along too.
    const singles = cell(page, seed.singlesMatchUpId);
    const doubles = cell(page, seed.doublesMatchUpId);
    await singles.waitFor({ state: 'visible', timeout: 10_000 });

    const familyName = seed.playerName.split(' ').at(-1) as string;
    await page.locator(SEARCH_INPUT).fill(familyName);

    await expect(singles).toHaveClass(new RegExp(HIGHLIGHT));
    await expect(doubles).toHaveClass(new RegExp(HIGHLIGHT));
  });
});
