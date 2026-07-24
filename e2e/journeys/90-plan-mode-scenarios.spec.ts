import { test, expect, Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 90 — Schedule scenarios "Plan mode"
 *
 * Alternate ("contingency") schedules staged off the live grid. Verifies:
 *   - Plan mode empty state → Create plan → "PLANNING — not live" badge + a
 *     persisted scenario.
 *   - A scenario's planned matchUps render as tinted cells; "Make official"
 *     commits the plan to the real schedule (uncompleted matchUps only).
 *   - Drift: an official schedule change flags the plan "out of date"; Rebase
 *     re-anchors and clears it.
 *
 * Following Journey 29's pattern, scenario setup + assertions go through the
 * engine surface; the UI drives create / commit / rebase. Mutations run
 * local-only (no provider seeded).
 */

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);

const PROFILE_PLAN = {
  tournamentName: 'E2E Plan Mode',
  tournamentAttributes: { tournamentId: 'e2e-plan-mode', startDate: SCHEDULE_DATE, endDate: SCHEDULE_DATE },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Plan Singles', drawSize: 8, seedsCount: 2, drawType: 'SINGLE_ELIMINATION' }],
  venueProfiles: [{ courtsCount: 4, venueName: 'Plan Venue' }],
};

const PLANNING_BADGE = /PLANNING/;

async function gotoPlanMode(page: Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  const planBtn = page.locator('button[title="Plan"]');
  await planBtn.waitFor({ timeout: 10_000 });
  await planBtn.click();
}

/**
 * Add a scenario (optionally with placements for the first N first-round
 * matchUps) directly on the engine + persist to IDB, so a subsequent
 * navigation reloads it. Optionally also drift the official schedule.
 */
async function seedScenario(
  page: Page,
  opts: { tournamentId: string; date: string; placementCount: number; driftFirst?: boolean },
): Promise<{ scenarioId: string; matchUpIds: string[]; times: string[] }> {
  return page.evaluate(async (o) => {
    await dev.tmx2db.initDB();
    const eng = dev.factory.tournamentEngine;
    const court = (eng.getVenuesAndCourts()?.venues?.[0]?.courts ?? [])[0];
    const matchUps = eng.allTournamentMatchUps({}).matchUps ?? [];
    const firstRound = matchUps.filter((m: any) => m.roundNumber === 1 && m.matchUpStatus !== 'BYE');
    const times = ['10:00', '11:00', '12:00', '13:00'];

    const chosen = firstRound.slice(0, o.placementCount);
    const placements = chosen.map((m: any, i: number) => ({
      tournamentId: o.tournamentId,
      matchUpId: m.matchUpId,
      schedule: {
        scheduledDate: o.date,
        scheduledTime: times[i],
        courtId: court.courtId,
        courtOrder: i + 1,
        venueId: court.venueId,
      },
    }));

    // Scenario authored against the current (unscheduled) baseline.
    const res: any = eng.addScheduleScenario({
      tournamentId: o.tournamentId,
      scenario: { scenarioName: 'Rain plan', placements },
    });

    // Optionally drift: officially schedule the first plan matchUp to a
    // different time AFTER the scenario is anchored.
    if (o.driftFirst && chosen[0]) {
      eng.addMatchUpScheduleItems({
        matchUpId: chosen[0].matchUpId,
        drawId: chosen[0].drawId,
        schedule: {
          scheduledDate: o.date,
          scheduledTime: '18:00',
          courtId: court.courtId,
          courtOrder: 4,
          venueId: court.venueId,
        },
      });
    }

    const record = eng.getTournament().tournamentRecord;
    await dev.tmx2db.addTournament(record);

    return {
      scenarioId: res.scenarioId as string,
      matchUpIds: chosen.map((m: any) => m.matchUpId),
      times: chosen.map((_: any, i: number) => times[i]),
    };
  }, opts);
}

test.describe('Journey 90 — schedule scenarios (Plan mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('empty state → Create plan shows the planning badge + persists a scenario', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_PLAN);
    await gotoPlanMode(page, tournamentId);

    await page.locator('button:has-text("Create plan")').click();

    await expect(page.getByText(PLANNING_BADGE)).toBeVisible({ timeout: 10_000 });

    const count = await page.evaluate(
      (tid) => dev.factory.competitionEngine.getScheduleScenarios({ tournamentId: tid }).scenarios.length,
      tournamentId,
    );
    expect(count).toBe(1);
  });

  test('a scenario renders planned cells and "Make official" commits it', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_PLAN);
    const { matchUpIds, times } = await seedScenario(page, {
      tournamentId,
      date: SCHEDULE_DATE,
      placementCount: 2,
    });

    await gotoPlanMode(page, tournamentId);
    await expect(page.getByText(PLANNING_BADGE)).toBeVisible({ timeout: 10_000 });

    // Planned matchUps render as tinted cells.
    await expect(page.locator('.tmx-planned-cell').first()).toBeVisible({ timeout: 10_000 });
    expect(await page.locator('.tmx-planned-cell').count()).toBeGreaterThanOrEqual(2);

    // Before commit, the official schedule of the plan matchUps is empty.
    const before = await page.evaluate(
      (ids) =>
        ids.map(
          (id) =>
            dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps.find((m: any) => m.matchUpId === id)
              ?.schedule?.scheduledTime,
        ),
      matchUpIds,
    );
    expect(before.every((t) => !t)).toBe(true);

    // Commit the plan.
    await page.locator('button:has-text("Make official")').click();
    await page.locator('.tippy-box button:has-text("Ok"), button:has-text("Ok")').last().click();

    // The plan's placements are now the official schedule.
    await expect(async () => {
      const after = await page.evaluate(
        (ids) =>
          ids.map(
            (id) =>
              dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps.find((m: any) => m.matchUpId === id)
                ?.schedule?.scheduledTime,
          ),
        matchUpIds,
      );
      expect(after.sort()).toEqual([...times].sort());
    }).toPass({ timeout: 10_000 });
  });

  test('a drifted plan shows "out of date" and Rebase clears it', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_PLAN);
    const { scenarioId } = await seedScenario(page, {
      tournamentId,
      date: SCHEDULE_DATE,
      placementCount: 1,
      driftFirst: true,
    });

    await gotoPlanMode(page, tournamentId);
    await expect(page.getByText(/out of date/i)).toBeVisible({ timeout: 10_000 });

    await page.locator('button:has-text("Rebase")').click();

    await expect(async () => {
      const outOfDate = await page.evaluate(
        ({ tid, sid }) =>
          dev.factory.competitionEngine.getScheduleScenarioStatus({ tournamentId: tid, scenarioId: sid }).outOfDate,
        { tid: tournamentId, sid: scenarioId },
      );
      expect(outOfDate).toBe(false);
    }).toPass({ timeout: 10_000 });

    await expect(page.getByText(/out of date/i)).toBeHidden();
  });
});
