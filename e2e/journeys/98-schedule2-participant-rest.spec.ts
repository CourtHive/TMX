import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 98 — Schedule2 participant rest.
 *
 * Covers the three surfaces that bring the rest figure to the point of decision:
 *
 *  1. **Inspector Rest section** — one row per individual, evaluated even for an
 *     UNSCHEDULED matchUp. That last part is the whole reason the section
 *     exists: readiness skips when there is no scheduledTime, which is exactly
 *     the state a matchUp is in when a director is deciding whether to call it.
 *  2. **Catalog card badge** — the headline on the card itself, so the answer is
 *     available while scanning, before a card is selected.
 *  3. **i18n + theme** — every string resolves (no dotted key paths leak), and
 *     the badge is legible in both light and dark.
 *
 * Seeded against a REAL completed matchUp rather than a hand-written schedule
 * fragment: the rest ladder reads `endTime` / `scoredTime` off the record, and a
 * seed that only sets `scheduledTime` would exercise the weakest rung while
 * appearing to pass. The control case (a player with nothing earlier that day)
 * must show no badge — a badge that always renders would pass a one-sided test.
 */

const SCHEDULE_DATE = todayLocal();

const INSPECTOR = '[data-panel="inspector"]';
const CATALOG_PANEL = '[data-panel="catalog"]';
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';
const REST_SECTION = '.tmx-rest';
const REST_ROW = '.tmx-rest-row';
const REST_BADGE = '.tmx-rest-badge';
const CARD = '.spl-matchup-card';

type Seed = { tournamentId: string; restingMatchUpId: string; freshMatchUpId: string };

/**
 * Plays out an R1 matchUp so a real winner advances with a real finish time,
 * then finds the R2 matchUp that winner feeds into. That R2 matchUp is left
 * UNSCHEDULED — the state the badge and the Rest section have to handle.
 *
 * Throws rather than falling back if the advancement doesn't materialise, so a
 * seed that stops producing a rested player fails loudly instead of leaving the
 * assertions to pass against an empty panel.
 */
async function seedRest(page: import('@playwright/test').Page): Promise<Seed> {
  return page.evaluate(
    async ({ date }) => {
      try {
        await dev.tmx2db.initDB();

        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          nonRandom: 1,
          setState: true,
          tournamentName: 'E2E Participant Rest',
          tournamentAttributes: { tournamentId: 'e2e-participant-rest', startDate: date, endDate: date },
          participantsProfile: { scaledParticipantsCount: 16 },
          drawProfiles: [{ eventName: 'Singles', drawSize: 8, seedsCount: 2, drawType: 'SINGLE_ELIMINATION' }],
          venueProfiles: [{ courtsCount: 2, venueName: 'Rest Venue' }],
        });

        const all = () => dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || [];
        const r1 = all().filter((m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1);
        const target = r1[0];

        // Every mutation is checked. A silent `{ error }` return here produced a
        // confusing "no R2 matchUp" failure downstream when the first draft of
        // this seed hand-wrote a one-set score against a best-of-3 format and
        // setMatchUpStatus rejected it with ERR_INVALID_SCORE.
        const must = (label: string, result: any) => {
          if (result?.error) throw new Error(`${label} failed: ${JSON.stringify(result.error)}`);
          return result;
        };

        // Schedule it, then complete it with an explicit END_TIME — the strongest
        // rung of the ladder, so the assertion is about the arithmetic and not
        // about which fallback happened to fire.
        must(
          'addMatchUpScheduleItems',
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: target.matchUpId,
            drawId: target.drawId,
            schedule: { scheduledDate: date, scheduledTime: '09:00', endTime: '10:30' },
          }),
        );

        // Built by the factory from a score string rather than hand-written, so
        // it is valid for whatever matchUpFormat the draw actually carries.
        const { outcome } = dev.factory.mocksEngine.generateOutcomeFromScoreString({
          matchUpFormat: target.matchUpFormat,
          scoreString: '6-1 6-2',
          winningSide: 1,
        });
        must(
          'setMatchUpStatus',
          dev.factory.tournamentEngine.setMatchUpStatus({
            matchUpId: target.matchUpId,
            drawId: target.drawId,
            outcome: { ...outcome, matchUpStatus: 'COMPLETED' },
          }),
        );

        const played = all().find((m: any) => m.matchUpId === target.matchUpId);
        const winnerIds: string[] = (played.sides || [])
          .filter((s: any) => s.sideNumber === played.winningSide)
          .flatMap((s: any) => [s.participantId, ...(s.participant?.individualParticipantIds || [])])
          .filter(Boolean);

        const idsOf = (m: any): string[] =>
          (m.sides || [])
            .flatMap((s: any) => [s.participantId, ...(s.participant?.individualParticipantIds || [])])
            .filter(Boolean);

        // The R2 matchUp the winner advanced into — unscheduled, and carrying a
        // participant who finished at 10:30.
        const resting = all().find(
          (m: any) => m.roundNumber === 2 && m.matchUpStatus !== 'BYE' && idsOf(m).some((id) => winnerIds.includes(id)),
        );
        if (!resting) {
          throw new Error('seed produced no R2 matchUp carrying the R1 winner — the rest assertion would be vacuous');
        }

        // Control: an R1 matchUp nobody has played yet, so no participant on it
        // has any prior match today.
        const fresh = r1.find((m: any) => m.matchUpId !== target.matchUpId && !idsOf(m).some((id) => winnerIds.includes(id)));
        if (!fresh) throw new Error('seed produced no untouched R1 matchUp for the control case');

        await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);

        return {
          tournamentId: tournamentRecord.tournamentId as string,
          restingMatchUpId: resting.matchUpId as string,
          freshMatchUpId: fresh.matchUpId as string,
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

async function openCatalog(page: import('@playwright/test').Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  await page.locator(UNSCHEDULED_TAB).click();
  await page.locator(CATALOG_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
}

test.describe('Journey 98 — Schedule2 participant rest', () => {
  let seed: Seed;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    seed = await seedRest(page);
    await openCatalog(page, seed.tournamentId);
  });

  test('the Rest section evaluates an UNSCHEDULED matchUp, which readiness skips', async ({ page }) => {
    await page.locator(`${CARD}[data-matchup-id="${seed.restingMatchUpId}"]`).click();

    const rest = page.locator(`${INSPECTOR} ${REST_SECTION}`);
    await expect(rest).toBeVisible();
    // Evaluated, not skipped — the data-rest hook carries the row count.
    await expect(rest).not.toHaveAttribute('data-rest', 'skipped');
    await expect(rest.locator(REST_ROW)).not.toHaveCount(0);

    // Readiness, on the same unscheduled matchUp, correctly reports it cannot
    // evaluate. The two sections answering differently is the point.
    await expect(page.locator(`${INSPECTOR} .tmx-readiness`)).toHaveAttribute('data-readiness', 'skipped');
  });

  test('the resting participant is reported with an elapsed figure and its provenance', async ({ page }) => {
    await page.locator(`${CARD}[data-matchup-id="${seed.restingMatchUpId}"]`).click();

    const rows = page.locator(`${INSPECTOR} ${REST_ROW}`);
    const statuses = await rows.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.status));
    // The advancing player finished at 10:30; the other side of the R2 matchUp
    // has not played, so exactly one row is not 'none'.
    expect(statuses.filter((s) => s !== 'none').length).toBeGreaterThan(0);

    const played = rows.filter({ hasNot: page.locator('[data-status="none"]') }).first();
    await expect(played.locator('.tmx-rest-figure')).not.toBeEmpty();
    await expect(played.locator('.tmx-rest-detail')).toContainText(/recorded end time|score entry|projected/i);
  });

  test('the catalog card carries a rest badge, and a card with no prior match does not', async ({ page }) => {
    const restingBadge = page.locator(`${CARD}[data-matchup-id="${seed.restingMatchUpId}"] ${REST_BADGE}`);
    await expect(restingBadge).toBeVisible();
    await expect(restingBadge).toHaveAttribute('data-rest-status', /rested|resting|oncourt/i);

    // Control — a badge that always renders would pass a one-sided test.
    const freshCard = page.locator(`${CARD}[data-matchup-id="${seed.freshMatchUpId}"]`);
    await expect(freshCard).toBeVisible();
    await expect(freshCard.locator(REST_BADGE)).toHaveCount(0);
  });

  test('no unresolved i18n key reaches the operator', async ({ page }) => {
    await page.locator(`${CARD}[data-matchup-id="${seed.restingMatchUpId}"]`).click();

    for (const scope of [`${INSPECTOR} ${REST_SECTION}`, `${CARD}[data-matchup-id="${seed.restingMatchUpId}"]`]) {
      const text = (await page.locator(scope).innerText()).trim();
      expect(text).not.toBe('');
      // `t()` echoes its key when it resolves to nothing; a dotted path in
      // rendered copy is the signature.
      expect(text).not.toMatch(/schedule\.(card|inspector)\.rest/);
      expect(text).not.toContain('{{');
    }
  });

  test('the badge is legible in BOTH light and dark', async ({ page }) => {
    const badge = page.locator(`${CARD}[data-matchup-id="${seed.restingMatchUpId}"] ${REST_BADGE}`);
    await expect(badge).toBeVisible();

    const readColours = () =>
      badge.evaluate((el) => {
        const style = getComputedStyle(el);
        return { color: style.color, border: style.borderTopColor, theme: document.documentElement.dataset.theme };
      });

    // Element-level shots, not page shots: a viewport screenshot puts the card
    // below the fold and shows nothing, which is worse than no screenshot at all
    // because it looks like evidence.
    const card = page.locator(`${CARD}[data-matchup-id="${seed.restingMatchUpId}"]`);
    await card.scrollIntoViewIfNeeded();

    // Set BOTH themes explicitly. The app boots in dark, so reading "light"
    // without setting it first silently reads dark twice — which is exactly
    // what the first version of this test did, and it looked like a pass.
    const setTheme = async (theme: 'light' | 'dark') => {
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      const applied = await page.evaluate(() => document.documentElement.dataset.theme);
      expect(applied).toBe(theme);
    };

    await setTheme('light');
    const light = await readColours();
    await card.screenshot({ path: 'e2e/test-results/98-rest-badge-light.png' });

    await setTheme('dark');
    const dark = await readColours();
    await card.screenshot({ path: 'e2e/test-results/98-rest-badge-dark.png' });

    // Both themes must resolve the tokens to something real — an unresolved
    // custom property computes to a transparent / empty value, which is the
    // failure this catches.
    for (const snapshot of [light, dark]) {
      expect(snapshot.color).toMatch(/^rgb/);
      expect(snapshot.color).not.toBe('rgba(0, 0, 0, 0)');
      expect(snapshot.border).not.toBe('rgba(0, 0, 0, 0)');
    }
    // The two themes must actually differ — `--tmx-accent-*` is defined per
    // theme, so identical colours mean the badge is reading a hard-coded value
    // or the theme never switched.
    expect(`${light.color}|${light.border}`).not.toBe(`${dark.color}|${dark.border}`);
  });
});
