import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

const DESK = '.tmx-checkin-desk';
const CARD = '.tmx-checkin-card';
const PERSON = '.tmx-checkin-person';
const MODAL = '.chc-modal-dialog';

async function seedDesk(page: Page, placed = true, date = todayLocal()) {
  return page.evaluate(
    async ({ date, placed }) => {
      const engine = dev.factory.tournamentEngine;
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentAttributes: { tournamentId: 'e2e-check-in-desk', startDate: date, endDate: date },
        drawProfiles: [{ drawType: 'ROUND_ROBIN', drawSize: 4, eventType: 'DOUBLES', eventName: 'Desk Doubles' }],
        venueProfiles: [{ courtsCount: 2, venueName: 'Desk Venue' }],
      });
      const { matchUps } = engine.allTournamentMatchUps({ inContext: true });
      const playable = matchUps.filter((m: any) =>
        m.sides?.every((s: any) => s.participant?.individualParticipants?.length === 2),
      );
      if (playable.length < 2) throw new Error('Desk fixture needs two hydrated doubles matches');
      const courts = engine.getVenuesAndCourts().venues[0].courts;
      for (const [index, matchUp] of playable.slice(0, 2).entries()) {
        let result: any = engine.addMatchUpScheduleItems({
          drawId: matchUp.drawId,
          matchUpId: matchUp.matchUpId,
          schedule: {
            scheduledDate: date,
            scheduledTime: '23:59',
            ...(placed ? { courtOrder: index + 1, courtId: courts[0].courtId, venueId: courts[0].venueId } : {}),
          },
        });
        if (!result.success) throw new Error(JSON.stringify(result));
      }
      await dev.load(engine.getTournament().tournamentRecord);
      return {
        tournamentId: tournamentRecord.tournamentId,
        matchUpId: playable[0].matchUpId,
        drawId: playable[0].drawId,
        courtIds: courts.map((c: any) => c.courtId),
        name: playable[0].sides[0].participant.individualParticipants[0].participantName,
        participantId: playable[0].sides[0].participant.individualParticipants[0].participantId,
      };
    },
    { date, placed },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(() => localStorage.clear());
});

test('round robin desk checks in individuals, refreshes counts, filters and persists independently of scheduling', async ({
  page,
}, testInfo) => {
  const seed = await seedDesk(page);
  const tournament = new TournamentPage(page);
  await tournament.goto(seed.tournamentId);
  await tournament.navigateToScheduling();
  await page.getByRole('button', { name: 'Check-In', exact: true }).click();
  await expect(page.locator(DESK)).toBeVisible();
  await expect(page.locator(CARD)).toHaveCount(2);
  const card = page.locator(`${CARD}[data-match-up-id="${seed.matchUpId}"]`);
  await expect(card).toContainText('0/4 checked in');
  await card.click();
  await expect(page.locator(PERSON)).toHaveCount(4);
  const person = page.locator(PERSON).first();
  await person.focus();
  await page.keyboard.press('Enter');
  await expect(person).toHaveAttribute('aria-pressed', 'true');
  await expect(person).toBeFocused();
  await expect(page.locator(CARD).filter({ hasText: '0/4 checked in' })).toHaveCount(1);
  await expect(card).toContainText('1/4 checked in');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: testInfo.outputPath('check-in-desk.png'), fullPage: true });
  await expect(page.locator(MODAL)).toHaveCount(0);
  await expect(card).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator(DESK).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('check-in-desk-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('combobox', { name: 'Check-in status', exact: true }).selectOption('partial');
  await expect(page.locator(CARD)).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Search participant names' }).fill(seed.name);
  await expect(card).toBeVisible();
  await page.getByRole('searchbox').fill('no such player');
  await expect(page.locator(CARD)).toHaveCount(0);
  await page.reload();
  await waitForAppReady(page);
  await expect(card).toContainText('1/4 checked in');
  const read = await page.evaluate(
    (id) => dev.factory.tournamentEngine.findMatchUp({ matchUpId: id }).matchUp,
    seed.matchUpId,
  );
  expect(read.checkedInParticipantIds).toContain(seed.participantId);
  expect(read.schedule.scheduledTime).toBe('23:59');
  expect(read.schedule.calledAt).toBeFalsy();
});

test('passive badges stay absent at zero and remain visible with prompts off after check-in', async ({ page }) => {
  const seed = await seedDesk(page, false);
  const tournament = new TournamentPage(page);
  await tournament.goto(seed.tournamentId);
  await tournament.navigateToScheduling();
  await expect(page.locator('.tmx-checkin-badge')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check-In', exact: true }).click();
  await page.locator(`${CARD}[data-match-up-id="${seed.matchUpId}"]`).click();
  await page.locator(PERSON).first().click();
  await expect(page.locator('.tmx-checkin-heading')).toContainText('1/4');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Grid', exact: true }).click();
  await expect(page.locator('.tmx-checkin-mode-toggle')).toHaveAttribute('data-check-in-mode', 'off');
  await page.locator('button[data-sidebar-tab="scheduled"]').click();
  await expect(page.locator('.tmx-checkin-badge').first()).toHaveText('1/4');
});

test('NOW drop warning cancels the whole placement; confirmation calls exactly once', async ({ page }) => {
  const seed = await seedDesk(page);
  const tournament = new TournamentPage(page);
  await tournament.goto(seed.tournamentId);
  await page.evaluate(() => {
    localStorage.setItem('tmx.schedule.checkInPromptMode', 'on');
  });
  await tournament.navigateToScheduling();
  const source = `[data-court-id="${seed.courtIds[0]}"][data-court-order="1"][data-matchup-id="${seed.matchUpId}"]`;
  const target = `.spl-active-strip-cell[data-court-id="${seed.courtIds[1]}"]`;
  await expect(page.locator(source)).toBeVisible();
  const collector = createMutationCollector(page);
  const before = await readSchedule(page, seed.matchUpId);
  await drop(page, source, target);
  await expect(page.locator(MODAL)).toContainText('have not checked in');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await readSchedule(page, seed.matchUpId)).toEqual(before);
  await drop(page, source, target);
  await page.getByRole('button', { name: 'Call to court anyway', exact: true }).click();
  await expect
    .poll(() => readSchedule(page, seed.matchUpId))
    .toMatchObject({ courtId: seed.courtIds[1], scheduledTime: '23:59' });
  const schedule = await readSchedule(page, seed.matchUpId);
  expect(schedule.calledAt).toBeTruthy();
  const calls = collector.getMethodNames().filter((method) => method === 'setMatchUpCalledAt');
  expect(calls).toHaveLength(1);
  collector.detach();
});

test('cell call warns, Escape cancels, and a changed match invalidates confirmation', async ({ page }) => {
  const seed = await seedDesk(page);
  const tournament = new TournamentPage(page);
  await tournament.goto(seed.tournamentId);
  await page.evaluate(() => localStorage.setItem('tmx.schedule.checkInPromptMode', 'on'));
  await tournament.navigateToScheduling();
  const cell = page.locator(
    `[data-court-id="${seed.courtIds[0]}"][data-court-order="1"][data-matchup-id="${seed.matchUpId}"]`,
  );
  await cell.click();
  await page.locator('[data-cell-panel] button').filter({ hasText: 'Call to court' }).click();
  await expect(page.locator(MODAL)).toContainText('have not checked in');
  await page.keyboard.press('Escape');
  expect((await readSchedule(page, seed.matchUpId)).calledAt).toBeFalsy();
  await cell.click();
  await page.locator('[data-cell-panel] button').filter({ hasText: 'Call to court' }).click();
  await expect(page.locator(MODAL)).toContainText('have not checked in');
  await page.evaluate((seed) => {
    let result: any = dev.factory.tournamentEngine.addMatchUpScheduleItems({
      matchUpId: seed.matchUpId,
      drawId: seed.drawId,
      schedule: { scheduledTime: '23:58' },
    });
    if (!result.success) throw new Error(JSON.stringify(result));
  }, seed);
  await page.getByRole('button', { name: 'Call to court anyway', exact: true }).click();
  await expect(
    page.getByText('The match or court changed while this dialog was open. Review it and try again.'),
  ).toBeVisible();
  expect((await readSchedule(page, seed.matchUpId)).calledAt).toBeFalsy();
});

test('an applied change updates the open editor and desk; play prevents checkout', async ({ page }) => {
  const seed = await seedDesk(page);
  const tournament = new TournamentPage(page);
  await tournament.goto(seed.tournamentId);
  await tournament.navigateToScheduling();
  await page.getByRole('button', { name: 'Check-In', exact: true }).click();
  const card = page.locator(`${CARD}[data-match-up-id="${seed.matchUpId}"]`);
  await card.click();
  await page.evaluate(async (seed) => {
    const engine = dev.factory.tournamentEngine;
    let result: any = engine.checkInParticipant({
      matchUpId: seed.matchUpId,
      drawId: seed.drawId,
      participantId: seed.participantId,
    });
    if (!result.success) throw new Error(JSON.stringify(result));
    const moduleUrl = '/src/services/mutation/mutationObservers.ts';
    const { notifyMutationApplied } = await import(moduleUrl);
    notifyMutationApplied();
  }, seed);
  const person = page.locator(`${PERSON}[data-participant-id="${seed.participantId}"]`);
  await expect(person).toHaveAttribute('aria-pressed', 'true');
  await expect(card).toContainText('1/4 checked in');
  await page.evaluate(async (seed) => {
    let result: any = dev.factory.tournamentEngine.setMatchUpStatus({
      matchUpId: seed.matchUpId,
      drawId: seed.drawId,
      outcome: { matchUpStatus: 'IN_PROGRESS' },
    });
    if (!result.success) throw new Error(JSON.stringify(result));
    const moduleUrl = '/src/services/mutation/mutationObservers.ts';
    const { notifyMutationApplied } = await import(moduleUrl);
    notifyMutationApplied();
  }, seed);
  await expect(person).toBeDisabled();
  await expect(page.locator(MODAL)).toContainText('Check-out is unavailable');
});

test('rejected attribution preserves stored state and allows a successful retry', async ({ page }) => {
  const seed = await seedDesk(page);
  await page.evaluate(async () => {
    const engine = dev.factory.tournamentEngine;
    const record = engine.getTournament().tournamentRecord;
    record.extensions = [
      ...(record.extensions ?? []),
      {
        name: 'appliedPolicies',
        value: {
          sanctioning: {
            policyName: 'Desk attribution test',
            presence: {
              COMPETITOR: {
                matchCheckIn: {
                  attribution: { allowedRelationships: ['SELF'], onInvalid: 'reject' },
                },
              },
            },
          },
        },
      },
    ];
    await dev.load(record);
  });
  const tournament = new TournamentPage(page);
  await tournament.goto(seed.tournamentId);
  await tournament.navigateToScheduling();
  await page.getByRole('button', { name: 'Check-In', exact: true }).click();
  const card = page.locator(`${CARD}[data-match-up-id="${seed.matchUpId}"]`);
  await card.click();
  await page.getByRole('button', { name: `Check in as…: ${seed.name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Parent', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Desk parent');
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(page.getByText('Could not change the check-in state', { exact: true })).toBeVisible();
  await expect(card).toContainText('0/4 checked in');
  await expect(page.locator('.tmx-checkin-editor')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator(PERSON).first()).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: `Check in as…: ${seed.name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Themselves', exact: true }).click();
  await expect(card).toContainText('1/4 checked in');
  await expect(page.locator(MODAL)).toContainText('Checked in by themselves');
  await expect(card).not.toContainText('Desk parent');
});

test('date-range authorization remains reachable inside the check-in dialog', async ({ page }) => {
  const seed = await seedDesk(page, true, '2020-01-01');
  const tournament = new TournamentPage(page);
  await tournament.goto(seed.tournamentId);
  // This past tournament exercises the real date-range authorization path.
  await page.evaluate(({ id, date }) => globalThis.location.assign(`#/tournament/${id}/scheduling/${date}/check-in`), {
    id: seed.tournamentId,
    date: '2020-01-01',
  });
  await page.locator(`${CARD}[data-match-up-id="${seed.matchUpId}"]`).click();
  await page.locator(PERSON).first().click();
  const modify = page.locator(MODAL).getByRole('button', { name: 'Modify?', exact: true });
  await expect(modify).toBeVisible();
  await modify.focus();
  await expect(modify).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.tmx-checkin-heading')).toContainText('1/4');
});

async function readSchedule(page: Page, matchUpId: string) {
  return page.evaluate((id) => dev.factory.tournamentEngine.findMatchUp({ matchUpId: id }).matchUp.schedule, matchUpId);
}

async function drop(page: Page, source: string, target: string) {
  await page.evaluate(
    ({ source, target }) => {
      const from = document.querySelector(source);
      const to = document.querySelector(target);
      if (!from || !to) throw new Error('Missing drop endpoints');
      const dataTransfer = new DataTransfer();
      const fire = (element: Element, type: string) =>
        element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
      fire(from, 'dragstart');
      fire(to, 'dragover');
      fire(to, 'drop');
      fire(from, 'dragend');
    },
    { source, target },
  );
}
