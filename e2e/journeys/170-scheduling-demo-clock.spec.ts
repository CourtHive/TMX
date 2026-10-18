import { createMutationCollector } from '../helpers/mutation-collector';
import { initDevBridge, resetState } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

const PANEL = '#demoClockPanel';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(async () => {
    // Use the actual catalog builder, not a parallel test fixture.
    const path = '/src/pages/tournaments/schedulerDemoProfile.ts';
    const { buildSchedulerDemoProfile } = await import(/* @vite-ignore */ path);
    const { tournamentRecord, error } = dev.factory.mocksEngine.generateTournamentRecord(buildSchedulerDemoProfile());
    if (error) throw new Error(JSON.stringify(error));
    await dev.load(tournamentRecord);
  });
  await page.evaluate(() => dev.tournamentContext.router.navigate('/tournament/scheduler-demo-three-days/scheduling'));
  await expect(page).toHaveURL(/scheduler-demo-three-days/);
  await page.locator('#login').click();
  await page.getByText('Demo mode…', { exact: true }).click();
  await page.getByRole('button', { name: 'Open Demo Clock', exact: true }).click();
  await expect(page.locator(PANEL)).toBeVisible();
});

test('runs Garman, Pro, and both together through normal day-scoped mutations', async ({ page }) => {
  const collector = createMutationCollector(page);
  const panel = page.locator(PANEL);
  const scenes = panel.locator('.tmx-demo-clock-scenes > div');
  await scenes.nth(0).getByRole('button', { name: 'Apply Garman times' }).click();
  await expect.poll(() => collector.hasMethod('scheduleProfileRounds')).toBe(true);
  await expect(panel.locator('p[role=status]')).toContainText('Scheduler applied');
  const first = await page.evaluate(
    () =>
      dev.factory.tournamentEngine
        .allTournamentMatchUps()
        .matchUps.filter((m: any) => m.drawId === 'scheduler-draw-garman')
        .filter((m: any) => m.schedule?.scheduledTime).length,
  );
  expect(first).toBeGreaterThan(0);

  await scenes.nth(1).getByRole('button', { name: 'Open day' }).click();
  await expect(page).toHaveURL(/scheduling\/\d{4}-\d{2}-\d{2}\/profile/);
  await scenes.nth(1).getByRole('button', { name: 'Apply Pro grid' }).click();
  await expect.poll(() => collector.hasMethod('scheduleProfileGrid')).toBe(true);
  await expect(panel.locator('p[role=status]')).toContainText('Scheduler applied');
  const pro = await page.evaluate(() =>
    dev.factory.tournamentEngine
      .allTournamentMatchUps()
      .matchUps.filter((m: any) => m.drawId === 'scheduler-draw-pro')
      .map((m: any) => m.schedule),
  );
  expect(pro.some((s: any) => s?.courtId && s.courtOrder)).toBe(true);
  expect(pro.some((s: any) => s?.scheduledTime)).toBe(false);

  await scenes.nth(2).getByRole('button', { name: 'Open day' }).click();
  await scenes.nth(2).getByRole('button', { name: 'Apply Garman times' }).click();
  await expect(panel.getByRole('button', { name: '+1 min', exact: true })).toBeEnabled();
  const before = await page.evaluate(() =>
    Object.fromEntries(
      dev.factory.tournamentEngine
        .allTournamentMatchUps()
        .matchUps.filter((m: any) => m.drawId.startsWith('scheduler-draw-hybrid') && m.schedule?.scheduledTime)
        .map((m: any) => [m.matchUpId, m.schedule.scheduledTime]),
    ),
  );
  expect(Object.keys(before).length).toBeGreaterThan(0);
  await scenes.nth(2).getByRole('button', { name: 'Apply Pro grid' }).click();
  await expect(panel.getByRole('button', { name: '+1 min', exact: true })).toBeEnabled();
  const combined = await page.evaluate(() =>
    dev.factory.tournamentEngine
      .allTournamentMatchUps()
      .matchUps.filter((m: any) => m.drawId.startsWith('scheduler-draw-hybrid') && m.schedule?.courtId)
      .map((m: any) => ({ id: m.matchUpId, time: m.schedule.scheduledTime, order: m.schedule.courtOrder })),
  );
  expect(combined).toHaveLength(Object.keys(before).length);
  for (const match of combined) {
    expect(match.time).toBe(before[match.id]);
    expect(match.order).toBeGreaterThan(0);
  }
  expect(
    collector
      .getMutations()
      .flatMap((m) => m.methods)
      .filter((m) => m.method.startsWith('scheduleProfile'))
      .every((m) => (m.params.scheduleDates as string[]).length === 1),
  ).toBe(true);
  collector.detach();
});

test('steps both clocks, keeps collapse usable, drags, refuses rewind and cleans up on exit/navigation', async ({
  page,
}) => {
  const panel = page.locator(PANEL);
  await expect(panel.locator('output')).toContainText('09:55');
  await panel.getByRole('button', { name: '+5 min', exact: true }).click();
  await expect(panel.locator('output')).toContainText('10:00');
  const stamp = await page.evaluate(() => dev.factory.tools.now().toISOString());
  expect(stamp).toContain('T14:00:00');
  await panel.getByLabel('Demo wall time').fill('09:00');
  await panel.getByRole('button', { name: 'Set time', exact: true }).click();
  await expect(panel.locator('p[role=status]')).toContainText('cannot be rewound');
  await expect(panel.locator('output')).toContainText('10:00');
  await panel.getByRole('button', { name: 'Collapse', exact: true }).click();
  await expect(panel.locator('output')).not.toBeVisible();
  await panel.getByRole('button', { name: 'Expand', exact: true }).click();
  const header = panel.locator('header');
  const rect = await header.boundingBox();
  await page.mouse.move(rect!.x + 30, rect!.y + 15);
  await page.mouse.down();
  await page.mouse.move(80, 80);
  await page.mouse.up();
  expect((await panel.boundingBox())!.x).toBeLessThan(150);
  await panel.getByRole('button', { name: 'Exit clock', exact: true }).click();
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => Math.abs(dev.factory.tools.now().getTime() - Date.now()))).toBeLessThan(1000);
});

test('next boundary refreshes the live strip immediately and leaving the tournament releases the clock', async ({
  page,
}) => {
  const panel = page.locator(PANEL);
  const combined = panel.locator('.tmx-demo-clock-scenes > div').nth(2);
  await combined.getByRole('button', { name: 'Open day' }).click();
  await combined.getByRole('button', { name: 'Apply Garman times' }).click();
  await expect(panel.getByRole('button', { name: '+1 min', exact: true })).toBeEnabled();
  await combined.getByRole('button', { name: 'Apply Pro grid' }).click();
  await expect(panel.getByRole('button', { name: '+1 min', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const address = globalThis.location.hash.replace('/profile', '/grid');
    dev.tournamentContext.router.navigate(address.slice(1));
  });
  const strip = page.locator('.spl-active-strip');
  await expect(strip).toBeVisible();
  await expect(strip).not.toContainText('DUE');
  await panel.getByRole('button', { name: /^Next: scheduled start/ }).click();
  await expect(panel.locator('output')).toContainText('10:00');
  await expect(strip).toContainText('DUE', { timeout: 2000 });
  await page.screenshot({ path: '/tmp/tmx-scheduling-demo-clock.png' });
  await page.evaluate(() => dev.tournamentContext.router.navigate('/tournaments'));
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => Math.abs(dev.factory.tools.now().getTime() - Date.now()))).toBeLessThan(1000);
});
