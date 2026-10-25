import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { todayLocal } from '../helpers/dates';

test('catalog placement and floating inspector preserve selection across both tabs', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  const tournamentId = await page.evaluate(async (date) => {
    localStorage.clear();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'Catalog placement',
      tournamentAttributes: { tournamentId: 'catalog-placement', startDate: date, endDate: date },
      participantsProfile: { scaledParticipantsCount: 16 },
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      venueProfiles: [{ venueName: 'Main', courtsCount: 12 }],
    });
    const matchUp = dev.factory.competitionEngine
      .allTournamentMatchUps({})
      .matchUps.find((m: any) => m.roundNumber === 1);
    if (!matchUp) throw new Error('Missing seeded matchUp');
    const result = dev.factory.tournamentEngine.addMatchUpScheduleItems({
      drawId: matchUp.drawId,
      matchUpId: matchUp.matchUpId,
      schedule: { scheduledDate: date, scheduledTime: '10:00' },
    });
    if (result.error) throw new Error(result.error);
    await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord ?? tournamentRecord);
    return tournamentRecord.tournamentId;
  }, todayLocal());
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  const layout = page.locator('.spl-layout');
  await expect(layout).toHaveAttribute('data-catalog-placement', 'left');
  const rowsControl = page.locator('[data-grid-rows-control="true"]');
  await expect(rowsControl).toBeVisible();
  expect(
    await rowsControl.evaluate((control) => (control.previousElementSibling as HTMLElement)?.dataset.gridWidthControl),
  ).toBe('true');
  await expect(page.locator('.spl-center-header [data-grid-rows-control]')).toHaveCount(0);
  const inspectorToggle = page.locator('[data-grid-inspector-toggle="true"]');
  await expect(inspectorToggle.locator('svg')).toHaveCount(1);
  // The Inspector toggle sits with the layout control, which arranges the workspace (#1767); Print stays in the
  // header with the actions that act on the schedule.
  expect(await inspectorToggle.evaluate((button) => button.nextElementSibling?.getAttribute('aria-label'))).toBe(
    'Scheduling layout',
  );
  await expect(page.locator('[data-schedule-print="true"]')).toBeVisible();
  await inspectorToggle.click();
  await expect(page.locator('[data-panel="inspector"]')).toBeHidden();
  await inspectorToggle.click();
  await expect(page.locator('[data-panel="inspector"]')).toBeVisible();
  await page.locator('[data-sidebar-tab="scheduled"]').click();
  const selected = page.locator('[data-sidebar-panel="scheduled"] .spl-matchup-card').first();
  await selected.click();
  const selectedId = await selected.getAttribute('data-match-up-id');
  await page.getByRole('button', { name: 'Scheduling layout' }).click();
  await expect(page.locator('.tmx-schedule-presentation button')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Catalog placement', exact: true }).selectOption('bottom');
  await expect(page.getByRole('combobox', { name: 'Catalog placement', exact: true })).toBeHidden();
  await expect(layout).toHaveAttribute('data-catalog-placement', 'bottom');
  await page.getByRole('button', { name: 'Scheduling layout' }).click();
  await page.getByRole('combobox', { name: 'Inspector placement', exact: true }).selectOption('floating');
  await expect(page.getByRole('combobox', { name: 'Inspector placement', exact: true })).toBeHidden();
  const floating = page.getByRole('dialog', { name: 'MatchUp inspector' });
  await expect(floating).toBeVisible();
  const beforeMove = (await floating.boundingBox())!;
  const header = floating.locator('.spl-floating-header');
  const handle = (await header.boundingBox())!;
  await page.mouse.move(handle.x + 20, handle.y + 15);
  await page.mouse.down();
  await page.mouse.move(520, 180, { steps: 6 });
  await page.mouse.up();
  expect((await floating.boundingBox())!.x).toBeLessThan(beforeMove.x);
  const beforeResize = (await floating.boundingBox())!;
  const resize = (await floating.getByRole('button', { name: 'Resize inspector with arrow keys' }).boundingBox())!;
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
  await page.mouse.down();
  await page.mouse.move(resize.x + 50, resize.y + 35, { steps: 6 });
  await page.mouse.up();
  expect((await floating.boundingBox())!.width).toBeGreaterThan(beforeResize.width);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('schedule2:inspector-geometry')!).width),
  ).toBeGreaterThan(beforeResize.width);
  await expect(selected).toHaveClass(/selected/);
  expect(await selected.getAttribute('data-match-up-id')).toBe(selectedId);
  await page.locator('[data-sidebar-tab="unscheduled"]').click();
  await expect(floating).toBeVisible();
  await floating.getByRole('button', { name: 'Dock', exact: true }).click();
  await expect(floating).toBeHidden();
  const inspector = page.locator('[data-panel="inspector"]');
  await expect(inspector).toBeVisible();
  const dock = page.locator('[data-panel="catalog-region"]');
  expect((await inspector.boundingBox())!.x).toBeGreaterThan((await dock.boundingBox())!.x);
  await page.getByRole('button', { name: 'Scheduling layout' }).click();
  await page.getByRole('combobox', { name: 'Catalog placement', exact: true }).selectOption('left');
  await expect(layout).toHaveAttribute('data-catalog-placement', 'left');
  expect(await page.evaluate(() => localStorage.getItem('schedule2:inspector-placement'))).toBe('"docked"');
});
