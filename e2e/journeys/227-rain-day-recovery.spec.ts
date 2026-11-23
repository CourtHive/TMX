import { initDevBridge, resetState, seedFeatureFlagInitScript, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';

const INTERRUPTED = '2026-11-21';
const TODAY = '2026-11-22';
const COURT_PLAN = 'Afternoon court plan';

async function openInterruptedTournament(page: Page) {
  await page.clock.setFixedTime(new Date(TODAY + 'T12:00:00'));
  await seedFeatureFlagInitScript(page, 'schedulePlan');
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  const fixture = await page.evaluate(
    async ({ interrupted, today, courtPlan }) => {
      const { tournamentEngine: engine, mocksEngine } = dev.factory;
      const {
        tournamentRecord,
        venueIds: [venueId],
      } = mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        startDate: interrupted,
        endDate: today,
        drawProfiles: [{ eventName: 'Singles', drawSize: 8 }],
        venueProfiles: [{ courtsCount: 4, startTime: '08:00', endTime: '20:00' }],
      });
      const { tournamentId } = tournamentRecord;
      // A quarterfinal still feeds yesterday's semifinal. Today's independent quarterfinal can start
      // while the semifinal is playing only under the ready policy.
      const { matchUps } = engine.allTournamentMatchUps({});
      const stale = matchUps.find((m: any) => m.roundNumber === 2 && m.roundPosition === 1);
      const target = matchUps.find((m: any) => m.roundNumber === 1 && m.roundPosition === 3);
      const [oldCourt, planCourt] = engine.getVenuesAndCourts().courts;
      const staleSchedule = {
        scheduledDate: interrupted,
        scheduledTime: '16:30',
        venueId,
        courtId: oldCourt.courtId,
        courtOrder: 1,
      };
      const targetSchedule = { scheduledDate: today, scheduledTime: '09:00', venueId };

      for (const [matchUp, schedule] of [
        [stale, staleSchedule],
        [target, targetSchedule],
      ]) {
        const result = engine.addMatchUpScheduleItems({
          matchUpId: matchUp.matchUpId,
          drawId: matchUp.drawId,
          schedule,
        });
        if (!result.success) throw new Error(JSON.stringify(result));
      }
      // A pre-existing plan also distinguishes opening the newly saved recovery from opening the first plan.
      const scenario = engine.addScheduleScenario({
        tournamentId,
        scenario: {
          scenarioName: courtPlan,
          placements: [
            {
              tournamentId,
              matchUpId: stale.matchUpId,
              schedule: {
                scheduledDate: today,
                scheduledTime: '14:00',
                venueId,
                courtId: planCourt.courtId,
                courtOrder: 2,
              },
            },
          ],
        },
      });
      if (!scenario.success) throw new Error(JSON.stringify(scenario));
      await dev.tmx2db.addTournament(engine.getTournament().tournamentRecord);
      return { tournamentId, staleId: stale.matchUpId, targetId: target.matchUpId, staleSchedule, venueId };
    },
    { interrupted: INTERRUPTED, today: TODAY, courtPlan: COURT_PLAN },
  );

  const tournament = new TournamentPage(page);
  await tournament.goto(fixture.tournamentId);
  await tournament.navigateToScheduling();
  return fixture;
}

async function officialSchedule(page: Page, matchUpId: string) {
  return page.evaluate(
    (id) => dev.factory.tournamentEngine.findMatchUp({ matchUpId: id, inContext: true }).matchUp.schedule,
    matchUpId,
  );
}

async function makeOfficial(page: Page) {
  await page.getByRole('button', { name: 'Make official', exact: true }).click();
  await page.getByRole('button', { name: 'Ok', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(TODAY + '/grid$'));
}

async function expectTimeWithoutCourt(page: Page, matchUpId: string, scheduledTime: string, venueId: string) {
  const schedule = await officialSchedule(page, matchUpId);
  expect(schedule).toMatchObject({ scheduledDate: TODAY, scheduledTime, venueId });
  expect(schedule.courtId).toBeFalsy();
  expect(schedule.courtOrder).toBeFalsy();
}

const scheduledCard = (page: Page, id: string) =>
  page.locator(`[data-sidebar-panel="scheduled"] .spl-matchup-card[data-matchup-id="${id}"]`);

test('carryover warning compares both releases and opens the chosen recovery as a plan', async ({ page }) => {
  const { staleId, targetId, staleSchedule, venueId } = await openInterruptedTournament(page);
  await page.locator('.tmx-carryover-warning').click();
  await expect(page.locator('.tmx-carryover-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Plan recovery…' }).click();
  await expect(page.getByText(/Assumptions in force.*90 min, 60 min rest/)).toBeVisible();
  await page.getByLabel('Singles per player').selectOption('3');

  for (const [policy, time, holds] of [
    ['ready', '09:00', 1],
    ['finish', '09:30', 0],
  ] as const) {
    const column = page.locator(`[data-recovery-policy="${policy}"]`);
    await expect(column).toContainText('Carryover finishes at 09:30');
    await expect(column).toContainText(`${holds} of 1 start times hold`);
    const targetGroup = column.locator('details').filter({ has: page.getByText('09:00 (1)', { exact: true }) });
    await targetGroup.locator('summary').click();
    await expect(targetGroup.locator('.tmx-recovery-time')).toContainText(time);
  }

  await page.locator('[data-recovery-policy="finish"]').getByRole('button', { name: 'Save as plan' }).click();
  await expect(page).toHaveURL(new RegExp(TODAY + '/plan$'));
  await expect(page.locator('option:checked').filter({ hasText: 'Wait for the carryover to finish' })).toHaveCount(1);
  await page.locator('button[data-sidebar-tab="scheduled"]').click();
  await expect(scheduledCard(page, staleId).locator('.spl-card-time-header')).toHaveText('08:00');
  await expect(scheduledCard(page, targetId).locator('.spl-card-time-header')).toHaveText('09:30');
  expect(await officialSchedule(page, staleId)).toMatchObject(staleSchedule);
  expect((await officialSchedule(page, targetId)).scheduledTime).toBe('09:00');

  await makeOfficial(page);
  await expectTimeWithoutCourt(page, staleId, '08:00', venueId);
  await expectTimeWithoutCourt(page, targetId, '09:30', venueId);
  await expect(page.locator('.tmx-carryover-warning')).toBeHidden();
});

test('Save times only removes the planned court and clears the old court when made official', async ({ page }) => {
  const { staleId, staleSchedule, venueId } = await openInterruptedTournament(page);
  await page.locator('button[title="Plan"]').click();
  await expect(page.locator('.tmx-planned-cell').first()).toBeVisible();
  const timesOnly = page.getByRole('button', { name: 'Save times only', exact: true });
  await timesOnly.click();
  await page.getByRole('button', { name: 'Ok', exact: true }).click();
  await expect(timesOnly).toBeHidden();
  await expect(page.locator('.tmx-planned-cell')).toHaveCount(0);
  await page.locator('button[data-sidebar-tab="scheduled"]').click();
  await expect(scheduledCard(page, staleId).locator('.spl-card-time-header')).toHaveText('14:00');
  expect(await officialSchedule(page, staleId)).toMatchObject(staleSchedule);

  await makeOfficial(page);
  await expectTimeWithoutCourt(page, staleId, '14:00', venueId);
});

test('opening recovery from an existing plan selects the new ready plan on the same date', async ({ page }) => {
  const { staleId, targetId } = await openInterruptedTournament(page);
  await page.locator('button[title="Plan"]').click();
  await expect(page.locator('option:checked').filter({ hasText: COURT_PLAN })).toHaveCount(1);
  await page.getByRole('button', { name: 'Plan recovery…' }).click();
  await page.locator('[data-recovery-policy="ready"]').getByRole('button', { name: 'Save as plan' }).click();
  await expect(page.locator('option:checked').filter({ hasText: 'Release as courts and players free up' })).toHaveCount(
    1,
  );
  await page.locator('button[data-sidebar-tab="scheduled"]').click();
  await expect(scheduledCard(page, staleId).locator('.spl-card-time-header')).toHaveText('08:00');
  await expect(scheduledCard(page, targetId).locator('.spl-card-time-header')).toHaveText('09:00');
});

test('the court-grid projection previews courts and commits the selected policy with its grid positions', async ({
  page,
}) => {
  const { staleId, targetId, staleSchedule } = await openInterruptedTournament(page);
  await page.locator('.tmx-carryover-warning').click();
  await page.getByRole('button', { name: 'Plan recovery…' }).click();
  const scheduler = page.getByLabel('Projection scheduler');
  await expect(scheduler).toHaveValue('profile');
  await scheduler.selectOption('grid');
  for (const [policy, time] of [
    ['ready', '09:00'],
    ['finish', '09:30'],
  ]) {
    const group = page.locator(`[data-recovery-policy="${policy}"] details`).filter({ hasText: '09:00 (1)' });
    await group.locator('summary').click();
    await expect(group.locator('.tmx-recovery-time')).toContainText(time + ' · Court');
  }
  await page.locator('[data-recovery-policy="finish"]').getByRole('button', { name: 'Save as plan' }).click();
  await expect(page.locator('option:checked').filter({ hasText: 'Court grid' })).toHaveCount(1);
  await expect(page.locator('.tmx-planned-cell')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Save times only', exact: true })).toBeVisible();
  expect(await officialSchedule(page, staleId)).toMatchObject(staleSchedule);
  await makeOfficial(page);
  const stale = await officialSchedule(page, staleId);
  const target = await officialSchedule(page, targetId);
  expect(stale).toMatchObject({
    scheduledDate: TODAY,
    scheduledTime: '08:00',
    courtId: expect.any(String),
    courtOrder: 1,
  });
  expect(target).toMatchObject({
    scheduledDate: TODAY,
    scheduledTime: '09:30',
    courtId: expect.any(String),
    courtOrder: 1,
  });
  expect(target.courtId).not.toBe(stale.courtId);
});
