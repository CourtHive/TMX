import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 97 — Schedule2 Inspector: both catalog views, toggleable, readiness.
 *
 * Before this workstream the Inspector existed only on the **Unscheduled** tab,
 * not by design but because `injectSidebarControls` captured every sidebar child
 * — the Inspector among them — as "catalog content" and hid the lot when the
 * Scheduled tab was shown. This journey pins the three things that changed:
 *
 *  1. The Inspector survives the tab switch.
 *
 *     ⚠️ **What actually makes this pass is the courthive-components side**, not
 *     the TMX `[data-panel="inspector"]` filter in `setTab`. The layout writes
 *     `inspectorVisible` onto the panel on EVERY render, so a store tick after
 *     the tab switch resets a `display:none` that `setTab` had applied. Verified
 *     by falsification: with the TMX filter removed this test still passes, and a
 *     DOM probe after the switch reads `catalog inline="none"` but
 *     `inspector inline=""`. The filter is kept because two owners of one
 *     element's `display` is a latent flash, but **this assertion does not
 *     discriminate between having it and not** — do not read a green run here as
 *     coverage of that filter.
 *  2. A Scheduled-panel card is selectable, and the Inspector reports it as
 *     **Scheduled: Yes** — the regression guard for the `isScheduled: false`
 *     forgery in `scheduledMatchUpToCatalogItem`, which exists so the cards stay
 *     draggable. Selecting that object directly would read "No".
 *  3. The toggle hides/shows the Inspector globally (both tabs) and the choice
 *     survives a reload via `schedule2:inspector-visible`.
 *
 * Readiness is asserted against a **seeded violation** rather than merely
 * checking that a heading renders: two R1 matchUps 30 minutes apart share a
 * participant, so the second cannot be ready at its scheduled time. A control
 * case (a lone matchUp with nothing else that day) must report no issues — a
 * readiness panel that always warns would pass a one-sided test.
 */

const SCHEDULE_DATE = todayLocal();

const INSPECTOR = '[data-panel="inspector"]';
const CATALOG_PANEL = '[data-panel="catalog"]';
const SCHEDULED_PANEL = '[data-sidebar-panel="scheduled"]';
const SCHEDULED_TAB = 'button[data-sidebar-tab="scheduled"]';
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';
const INSPECTOR_TOGGLE = 'button[data-inspector-toggle="true"]';
const SCHEDULED_CARD = `${SCHEDULED_PANEL} .spl-matchup-card`;
const READINESS = '.tmx-readiness';
const READINESS_FINDING = '.tmx-readiness-finding';
const READINESS_OK = '.tmx-readiness-ok';
const KV_ROW = `${INSPECTOR} .sp-kv`;

type Seed = { tournamentId: string; clashingMatchUpId: string };

/**
 * `clash` mode: two singles events drawn from ONE participant pool, so some
 * player necessarily appears in both draws. The seed then *searches* for a
 * cross-event pair of R1 matchUps that genuinely share an individual and
 * schedules them 30 minutes apart — the later one cannot be ready, because the
 * shared player is still on court.
 *
 * It **throws** when no such pair exists rather than scheduling an arbitrary
 * pair, so a seed that stops producing a clash fails loudly instead of leaving
 * the readiness assertion to pass vacuously against an empty panel.
 *
 * (An earlier version rewrote `positionAssignments` directly to force the shared
 * participant. It did not survive into the hydrated matchUps, and produced
 * exactly that vacuous pass — no findings, and nothing to say why.)
 *
 * `clean` mode schedules a single matchUp with nothing else that day.
 */
async function seedInspector(page: import('@playwright/test').Page, mode: 'clash' | 'clean'): Promise<Seed> {
  return page.evaluate(
    async ({ date, mode }) => {
      try {
        await dev.tmx2db.initDB();

        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          nonRandom: 1,
          setState: true,
          tournamentName: 'E2E Inspector Readiness',
          tournamentAttributes: {
            tournamentId: `e2e-inspector-${mode}`,
            startDate: date,
            endDate: date,
          },
          participantsProfile: { scaledParticipantsCount: 16 },
          drawProfiles:
            mode === 'clean'
              ? [{ eventName: 'Singles', drawSize: 8, seedsCount: 2, drawType: 'SINGLE_ELIMINATION' }]
              : [
                  { eventName: 'Singles A', drawSize: 8, seedsCount: 2, drawType: 'SINGLE_ELIMINATION' },
                  { eventName: 'Singles B', drawSize: 8, seedsCount: 2, drawType: 'SINGLE_ELIMINATION' },
                ],
          venueProfiles: [{ courtsCount: 2, venueName: 'Inspector Venue' }],
        });

        const r1 = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
          (m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1,
        );

        const schedule = (matchUp: any, scheduledTime: string) =>
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: matchUp.matchUpId,
            drawId: matchUp.drawId,
            schedule: { scheduledDate: date, scheduledTime },
          });

        const idsOf = (matchUp: any): string[] =>
          (matchUp.sides || [])
            .flatMap((s: any) => [s.participantId, ...(s.participant?.individualParticipantIds || [])])
            .filter(Boolean);

        let clashingMatchUpId = r1[0].matchUpId;

        if (mode === 'clean') {
          schedule(r1[0], '10:00');
        } else {
          // Find a cross-event pair sharing an individual participant.
          let pair: any[] | undefined;
          for (const a of r1) {
            const aIds = new Set(idsOf(a));
            pair = [a, r1.find((b: any) => b.eventId !== a.eventId && idsOf(b).some((id) => aIds.has(id)))].filter(
              Boolean,
            );
            if (pair.length === 2) break;
            pair = undefined;
          }
          if (!pair) {
            throw new Error(
              'seed produced no cross-event matchUp pair sharing a participant — the clash assertion would pass vacuously',
            );
          }
          // 09:30 then 10:00: 30 minutes apart, so the shared player is still on
          // court (90 min average) when the second matchUp is due to start.
          schedule(pair[0], '09:30');
          schedule(pair[1], '10:00');
          clashingMatchUpId = pair[1].matchUpId;
        }

        const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        await dev.tmx2db.addTournament(mutated);

        return { tournamentId: tournamentRecord.tournamentId as string, clashingMatchUpId };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: SCHEDULE_DATE, mode },
  );
}

async function openScheduling(page: import('@playwright/test').Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
}

async function openScheduledTab(page: import('@playwright/test').Page): Promise<void> {
  await page.locator(SCHEDULED_TAB).click();
  await page.locator(SCHEDULED_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * Explicit, because the sidebar does NOT reliably open on Unscheduled:
 * `resolveInitialTab` lands on **Scheduled** whenever the selected date already
 * has scheduled-but-unplaced matchUps — which every seed here creates.
 */
async function openUnscheduledTab(page: import('@playwright/test').Page): Promise<void> {
  await page.locator(UNSCHEDULED_TAB).click();
  await page.locator(CATALOG_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
}

test.describe('Journey 97 — Schedule2 Inspector readiness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('Inspector is present on BOTH the Unscheduled and Scheduled tabs', async ({ page }) => {
    const { tournamentId } = await seedInspector(page, 'clash');
    await openScheduling(page, tournamentId);

    // Unscheduled side: the Inspector has always been here.
    await openUnscheduledTab(page);
    await expect(page.locator(INSPECTOR)).toBeVisible();
    await expect(page.locator(CATALOG_PANEL)).toBeVisible();

    await openScheduledTab(page);

    // The regression this workstream fixes: the catalog is hidden, the
    // Inspector is NOT.
    await expect(page.locator(CATALOG_PANEL)).toBeHidden();
    await expect(page.locator(INSPECTOR)).toBeVisible();
  });

  test('the Inspector occupies the SAME slot on both tabs', async ({ page }) => {
    const { tournamentId } = await seedInspector(page, 'clash');
    await openScheduling(page, tournamentId);

    const topOf = async (selector: string) => {
      const box = await page.locator(selector).boundingBox();
      if (!box) throw new Error(`no bounding box for ${selector}`);
      return box.y;
    };

    await openUnscheduledTab(page);
    const unscheduledTop = await topOf(INSPECTOR);
    expect(unscheduledTop).toBeGreaterThan(await topOf(CATALOG_PANEL));

    await openScheduledTab(page);
    const scheduledTop = await topOf(INSPECTOR);
    // The Scheduled panel is inserted BEFORE the Inspector rather than appended
    // to the sidebar; appending put the Inspector at the top of the Scheduled
    // tab and the bottom of the Unscheduled one.
    expect(scheduledTop).toBeGreaterThan(await topOf(SCHEDULED_PANEL));
    // Below-the-list is not enough — it must land at the same height, which is
    // what the Scheduled panel's `flex: 3` (matching the catalog) buys.
    expect(Math.abs(scheduledTop - unscheduledTop)).toBeLessThan(2);
  });

  test('selecting a Scheduled card populates the Inspector and reports Scheduled: Yes', async ({ page }) => {
    const { tournamentId } = await seedInspector(page, 'clash');
    await openScheduling(page, tournamentId);
    await openScheduledTab(page);

    // Empty state first — nothing selected yet.
    await expect(page.locator(`${INSPECTOR} .sp-small`)).toBeVisible();

    await page.locator(SCHEDULED_CARD).first().click();

    await expect(page.locator(KV_ROW).first()).toBeVisible();
    // `scheduledMatchUpToCatalogItem` forges `isScheduled: false` so the cards
    // stay draggable; selection resolves the real catalog item instead, so this
    // must read Yes. Reading "No" means the forgery reached the store.
    await expect(page.locator(INSPECTOR)).toContainText('Scheduled');
    await expect(page.locator(INSPECTOR)).toContainText('Yes');
    await expect(page.locator(SCHEDULED_CARD).first()).toHaveClass(/selected/);
  });

  test('readiness flags a participant who cannot be ready at the scheduled time', async ({ page }) => {
    const { tournamentId } = await seedInspector(page, 'clash');
    await openScheduling(page, tournamentId);
    await openScheduledTab(page);

    // The later of the two clashing matchUps is the second card (sorted by time).
    await page.locator(SCHEDULED_CARD).nth(1).click();

    await expect(page.locator(READINESS)).toBeVisible();
    await expect(page.locator(READINESS_FINDING).first()).toBeVisible();
    // Either kind is a correct answer for this seed depending on how the
    // engine resolves the average for the format; both mean "not ready".
    await expect(
      page.locator(`${READINESS_FINDING}[data-kind="overlap"], ${READINESS_FINDING}[data-kind="recovery"]`),
    ).not.toHaveCount(0);
  });

  test('readiness reports no issues for a matchUp with nothing else that day', async ({ page }) => {
    const { tournamentId } = await seedInspector(page, 'clean');
    await openScheduling(page, tournamentId);
    await openScheduledTab(page);

    await page.locator(SCHEDULED_CARD).first().click();

    // The control: a readiness panel that always warns would have passed the
    // test above on its own.
    await expect(page.locator(READINESS_OK)).toBeVisible();
    await expect(page.locator(READINESS_FINDING)).toHaveCount(0);
  });

  test('the toggle hides the Inspector on both tabs and the choice survives a reload', async ({ page }) => {
    const { tournamentId } = await seedInspector(page, 'clash');
    await openScheduling(page, tournamentId);
    await openUnscheduledTab(page);

    await expect(page.locator(INSPECTOR)).toBeVisible();
    await expect(page.locator(INSPECTOR_TOGGLE)).toHaveAttribute('aria-pressed', 'true');

    await page.locator(INSPECTOR_TOGGLE).click();
    await expect(page.locator(INSPECTOR)).toBeHidden();
    await expect(page.locator(INSPECTOR_TOGGLE)).toHaveAttribute('aria-pressed', 'false');

    // Global to the catalog: still hidden after switching tabs.
    await openScheduledTab(page);
    await expect(page.locator(INSPECTOR)).toBeHidden();

    // Persisted.
    expect(await page.evaluate(() => localStorage.getItem('schedule2:inspector-visible'))).toBe('false');

    await page.reload();
    await waitForAppReady(page);
    await openScheduling(page, tournamentId);
    await expect(page.locator(INSPECTOR)).toBeHidden();

    // And back again — the toggle is not one-way.
    await page.locator(INSPECTOR_TOGGLE).click();
    await expect(page.locator(INSPECTOR)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('schedule2:inspector-visible'))).toBeNull();
  });

  test('selection while hidden does not auto-open the Inspector', async ({ page }) => {
    const { tournamentId } = await seedInspector(page, 'clash');
    await openScheduling(page, tournamentId);
    await page.locator(INSPECTOR_TOGGLE).click();
    await openScheduledTab(page);
    await expect(page.locator(INSPECTOR)).toBeHidden();

    await page.locator(SCHEDULED_CARD).first().click();

    // A persisted operator choice is not overridden by selecting a card
    // (decision recorded in the workstream plan). Revealing it afterwards shows
    // the selection that was made while hidden.
    await expect(page.locator(INSPECTOR)).toBeHidden();
    await page.locator(INSPECTOR_TOGGLE).click();
    await expect(page.locator(KV_ROW).first()).toBeVisible();
  });
});
