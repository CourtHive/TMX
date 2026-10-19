import { createMutationCollector } from '../helpers/mutation-collector';
import { initDevBridge, resetState } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

const PANEL = '#demoClockPanel';

test.beforeEach(async ({ page }) => {
  // Bypass the animated splash's delayed redirect while seeding a tournament.
  await page.goto('/#/tournaments');
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
  await page.locator(PANEL).getByRole('button', { name: 'Clock controls', exact: true }).click();
  await page.locator(PANEL).getByLabel('Demo mode', { exact: true }).selectOption('script');
  await page.locator(PANEL).getByLabel('Demo wall time').fill('09:55');
  await page.locator(PANEL).getByRole('button', { name: 'Set time', exact: true }).click();
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

test('steps both clocks, keeps centered controls usable, refuses rewind and cleans up on exit', async ({ page }) => {
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
  await panel.getByRole('button', { name: 'Hide controls', exact: true }).click();
  await expect(panel.locator('.tmx-demo-clock-body')).not.toBeVisible();
  await expect(panel.locator('output')).toContainText('10:00');
  await panel.getByRole('button', { name: 'Clock controls', exact: true }).click();
  const panelRect = await panel.boundingBox();
  const slotRect = await panel.locator('..').boundingBox();
  expect(Math.abs(panelRect!.x + panelRect!.width / 2 - slotRect!.x - slotRect!.width / 2)).toBeLessThan(2);
  await expect(page.locator('.tmx-demo-clock-bar')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Exit clock', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('#demoBadge')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('tmx_demo_overlay'))).toBeNull();
  expect(await page.evaluate(() => Math.abs(dev.factory.tools.now().getTime() - Date.now()))).toBeLessThan(1000);
});

test('next boundary auto-calls the due matches on the demo clock and leaving the tournament releases the clock', async ({
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
  // The demo tournament has no provider, so this anonymous client is its running desk and auto-call fires
  // (isRunningDesk). The call is stamped with the paused demo clock, not real time.
  const collector = createMutationCollector(page);
  await panel.getByRole('button', { name: /^Next: scheduled start/ }).click();
  await expect(panel.locator('output')).toContainText('10:00');
  const entry = await collector.waitForMethod('setMatchUpCalledAt', 5000);
  const calls = entry.methods.filter((m) => m.method === 'setMatchUpCalledAt');
  expect(calls).toHaveLength(4);
  const demoNow = await page.evaluate(() => dev.factory.tools.now().getTime());
  for (const call of calls) expect(Date.parse((call.params as any).calledAt)).toBe(demoNow);
  await expect(strip).not.toContainText('DUE');
  await expect(strip.getByText('NEXT')).toHaveCount(4);
  collector.detach();
  await page.evaluate(() => dev.tournamentContext.router.navigate('/tournaments'));
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => Math.abs(dev.factory.tools.now().getTime() - Date.now()))).toBeLessThan(1000);
});

test('reuses scheduling footers, docks on MatchUps, and restores both bar colors on exit', async ({ page }) => {
  const panel = page.locator(PANEL);
  await panel.getByRole('button', { name: 'Hide controls', exact: true }).click();
  await expect(page.locator('.tmx-demo-clock-bar')).toHaveCount(0);
  await expect(panel.locator('..')).toHaveClass(/tmx-demo-clock-slot/);
  await expect(page.locator('#demoBanner')).toHaveCount(0);
  await expect(page.locator('#demoBadge')).toBeVisible();
  const colors = await page.evaluate(() => ({
    nav: getComputedStyle(document.getElementById('dnav')!).backgroundColor,
    footer: getComputedStyle(document.querySelector('.tmx-demo-clock-host--active')!).backgroundColor,
  }));
  expect(colors.nav).toBe(colors.footer);
  await page.evaluate(() => dev.tournamentContext.router.navigate('/tournament/scheduler-demo-three-days/matchUps'));
  await expect(page.locator('.tmx-demo-clock-bar')).toBeVisible();
  await expect(panel.locator('output')).toContainText('09:55');
  const rect = await panel.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(rect!.x + rect!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height);
  const table = page.locator('.tabulator:visible').first();
  await expect
    .poll(async () => (await table.boundingBox())!.y + (await table.boundingBox())!.height)
    .toBeLessThanOrEqual((await page.locator('.tmx-demo-clock-bar').boundingBox())!.y + 1);
  await page.evaluate(() => dev.tournamentContext.router.navigate('/tournament/scheduler-demo-three-days/scheduling'));
  await expect(panel.locator('..')).toHaveClass(/tmx-demo-clock-slot/);
  await expect(page.locator('.tmx-demo-clock-bar')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Exit clock', exact: true }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-tmx-demo-clock');
  await expect(page.locator('.tmx-demo-clock-host--active')).toHaveCount(0);
  expect(await page.locator('#dnav').evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    colors.nav,
  );
});

test('exiting demo mode removes the clock and signed-in sessions cannot reopen it', async ({ page }) => {
  await page.evaluate(async () => {
    const statePath = '/src/services/demoMode/demoState.ts';
    const { clearDemoOverlay } = await import(/* @vite-ignore */ statePath);
    clearDemoOverlay();
  });
  await expect(page.locator(PANEL)).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-tmx-demo-clock');
  await page.evaluate(async () => {
    const tokenPath = '/src/services/authentication/tokenManagement.ts';
    const panelPath = '/src/components/demoClock/demoClockPanel.ts';
    const { setToken } = await import(/* @vite-ignore */ tokenPath);
    const { openDemoClockPanel } = await import(/* @vite-ignore */ panelPath);
    setToken(`header.${btoa(JSON.stringify({ roles: ['superadmin'], exp: Date.now() / 1000 + 3600 }))}.signature`);
    openDemoClockPanel();
  });
  await expect(page.locator(PANEL)).toHaveCount(0);
  expect(await page.evaluate(() => Math.abs(dev.factory.tools.now().getTime() - Date.now()))).toBeLessThan(1000);
});

test('Availability reuses the workspace bar without adding a second Scheduling footer', async ({ page }) => {
  await page.locator(PANEL).getByRole('button', { name: 'Hide controls', exact: true }).click();
  await page.evaluate(() => {
    const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
    dev.tournamentContext.router.navigate(
      `/tournament/${record.tournamentId}/scheduling/${record.startDate}/availability`,
    );
  });
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();
  await expect(panel.locator('..')).toHaveClass(/tmx-demo-clock-slot/);
  await expect(page.locator('.tmx-demo-clock-bar')).toHaveCount(0);
  await expect(page.locator('.tmx-demo-clock-host--active')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Exit clock', exact: true }).click();
  await expect(page.locator('[data-clock-workspace]')).not.toBeVisible();
});

test('loads a fresh guided tournament and captures a clock walkthrough', async ({ page }) => {
  await page.locator(PANEL).getByRole('button', { name: 'Exit clock', exact: true }).click();
  await page.evaluate(() => dev.context({ perf: true }));
  await page.locator('#login').click();
  await page.getByText('Demo mode…', { exact: true }).click();
  await page.getByRole('button', { name: 'Load guided scheduling demo', exact: true }).click();
  await expect(page).toHaveURL(/tournament\/scheduling-demo-(?!three-days)/);
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Clock controls', exact: true }).click();
  await expect(panel.getByLabel('Demo mode', { exact: true })).toHaveValue('script');
  await panel.getByRole('button', { name: 'Start recording', exact: true }).click();
  await panel.getByRole('button', { name: '+5 min', exact: true }).click();
  await panel.getByRole('button', { name: 'Stop recording', exact: true }).click();
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export recording', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^demo-walkthrough-.*\.json$/);
  await panel.getByLabel('Demo mode', { exact: true }).selectOption('clock');
  await expect(panel.locator('.tmx-demo-clock-scenes')).not.toBeVisible();
});

test('the clock starts on the first day even when the page shows a later day', async ({ page }) => {
  const panel = page.locator(PANEL);
  await panel.getByRole('button', { name: 'Exit clock', exact: true }).click();
  await expect(panel).toHaveCount(0);
  const { firstDay, lastDay } = await page.evaluate(() => {
    const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
    return { firstDay: record.startDate, lastDay: record.endDate };
  });
  expect(lastDay > firstDay).toBe(true);
  // The Scheduling page on the LAST day: free clock used to start on the date the page showed.
  await page.evaluate(
    (date) => dev.tournamentContext.router.navigate(`/tournament/scheduler-demo-three-days/scheduling/${date}/profile`),
    lastDay,
  );
  await expect(page).toHaveURL(new RegExp(lastDay));
  await page.locator('#login').click();
  await page.getByText('Demo mode…', { exact: true }).click();
  await page.getByRole('button', { name: 'Open Demo Clock', exact: true }).click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('output')).toHaveAttribute('title', new RegExp(`^${firstDay} `));
  await expect(panel.locator('output')).toContainText('08:00');
});
