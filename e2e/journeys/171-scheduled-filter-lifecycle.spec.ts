import { initDevBridge, resetState } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

const PANEL = '[data-sidebar-panel="scheduled"]';
const CARDS = `${PANEL} .spl-matchup-card`;
const FIRST_DAY = '2026-10-20';
const NEXT_DAY = '2026-10-21';
const ID = 'e2e-scheduled-filter-lifecycle';

async function navigate(page: import('@playwright/test').Page, day: string): Promise<void> {
  await page.evaluate(
    ({ id, day }) => dev.tournamentContext.router.navigate(`/tournament/${id}/scheduling/${day}/grid`),
    {
      id: ID,
      day,
    },
  );
  await expect(page.locator(PANEL)).toBeVisible();
}

async function openFilters(page: import('@playwright/test').Page) {
  await page.locator(`${PANEL} .spl-catalog-filter-btn`).click();
  return page.locator('.spl-filter-popover');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/tournaments');
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(
    async ({ id, first, next }) => {
      localStorage.clear();
      dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentAttributes: { tournamentId: id, startDate: first, endDate: next },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [
          { eventName: 'Alpha', gender: 'MALE', drawSize: 8 },
          { eventName: 'Beta', gender: 'FEMALE', drawSize: 8 },
        ],
        venueProfiles: [{ courtsCount: 2 }],
      });
      for (const match of dev.factory.tournamentEngine
        .allTournamentMatchUps()
        .matchUps.filter((m: any) => m.roundNumber === 1)) {
        const sameEvent = dev.factory.tournamentEngine
          .allTournamentMatchUps()
          .matchUps.filter((m: any) => m.roundNumber === 1 && m.eventId === match.eventId);
        const date = sameEvent[0].matchUpId === match.matchUpId ? first : next;
        if (match.eventName === 'Beta' && date === next) continue;
        const result = dev.factory.tournamentEngine.addMatchUpScheduleItems({
          matchUpId: match.matchUpId,
          drawId: match.drawId,
          schedule: { scheduledDate: date, scheduledTime: '10:00' },
        });
        if (!result.success) throw new Error(JSON.stringify(result));
      }
      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
    },
    { id: ID, first: FIRST_DAY, next: NEXT_DAY },
  );
  // A full navigation exercises the real IDB tournament loader.
  await page.goto(`/#/tournament/${ID}/scheduling/${FIRST_DAY}/grid`);
  await initDevBridge(page);
  await expect(page.locator(CARDS)).toHaveCount(2);
});

test('keeps valid empty combinations visible, and Clear All restores the cards', async ({ page }) => {
  let popover = await openFilters(page);
  await popover
    .locator('select')
    .filter({ has: page.locator('option[value="Alpha"]') })
    .selectOption('Alpha');
  await popover
    .locator('select')
    .filter({ has: page.locator('option[value="FEMALE"]') })
    .selectOption('FEMALE');
  await expect(page.locator(CARDS)).toHaveCount(0);
  await expect(page.locator(PANEL)).toContainText('current filters and search');
  await popover.locator('.spl-filter-close-btn').click();
  popover = await openFilters(page);
  await expect(popover.locator('select').filter({ has: page.locator('option[value="Alpha"]') })).toHaveValue('Alpha');
  await expect(popover.locator('select').filter({ has: page.locator('option[value="FEMALE"]') })).toHaveValue('FEMALE');
  await popover.locator('.spl-filter-close-btn').click();
  await page.locator(PANEL).getByRole('button', { name: 'Clear All', exact: true }).click();
  await expect(page.locator(CARDS)).toHaveCount(2);
});

test('changes days retaining valid filters and search, clearing absent values, and showing active single-value controls', async ({
  page,
}) => {
  const popover = await openFilters(page);
  await popover
    .locator('select')
    .filter({ has: page.locator('option[value="Alpha"]') })
    .selectOption('Alpha');
  await popover
    .locator('select')
    .filter({ has: page.locator('option[value="FEMALE"]') })
    .selectOption('FEMALE');
  await popover.locator('.spl-filter-close-btn').click();
  await page.locator(`${PANEL} input[type="text"]`).fill('missing player');
  await navigate(page, NEXT_DAY);
  await expect(page.locator(`${PANEL} input[type="text"]`)).toHaveValue('missing player');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('schedule2:scheduled-filters') || '{}'))).toEqual({
    eventName: 'Alpha',
  });
  const nextPopover = await openFilters(page);
  const event = nextPopover.locator('select').filter({ has: page.locator('option[value="Alpha"]') });
  await expect(event).toBeVisible();
  await expect(event).toHaveValue('Alpha');
  await expect(event.locator('option')).toHaveCount(2);
  await nextPopover.getByRole('button', { name: 'Clear All', exact: true }).click();
  await expect(page.locator(CARDS)).toHaveCount(3);
  await expect(page.locator(`${PANEL} input[type="text"]`)).toHaveValue('');
  await expect(page.locator(PANEL).getByRole('button', { name: 'Clear search' })).not.toBeVisible();
});

test('a tournament reload clears saved search and filter selections', async ({ page }) => {
  const popover = await openFilters(page);
  await popover
    .locator('select')
    .filter({ has: page.locator('option[value="Alpha"]') })
    .selectOption('Alpha');
  await popover.locator('.spl-filter-close-btn').click();
  await page.locator(`${PANEL} input[type="text"]`).fill('missing player');
  await page.reload();
  await expect(page.locator(CARDS)).toHaveCount(2);
  await expect(page.locator(`${PANEL} input[type="text"]`)).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('schedule2:scheduled-filters'))).toBeNull();
});

test('a data update clears a renamed event filter while retaining other valid selections', async ({ page }) => {
  const popover = await openFilters(page);
  await popover
    .locator('select')
    .filter({ has: page.locator('option[value="Alpha"]') })
    .selectOption('Alpha');
  await popover
    .locator('select')
    .filter({ has: page.locator('option[value="MALE"]') })
    .selectOption('MALE');
  await popover.locator('.spl-filter-close-btn').click();
  await page.evaluate(async () => {
    const match = dev.factory.tournamentEngine
      .allTournamentMatchUps()
      .matchUps.find((m: any) => m.eventName === 'Alpha');
    await new Promise<void>((resolve) => {
      dev.mutationRequest({
        methods: [
          { method: 'modifyEvent', params: { eventId: match.eventId, eventUpdates: { eventName: 'Renamed' } } },
        ],
        callback: () => {
          dev.tournamentContext.refreshActiveTable?.();
          resolve();
        },
      });
    });
  });
  await expect(page.locator(CARDS)).toHaveCount(1);
  await expect(page.locator(CARDS)).toContainText('Renamed');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('schedule2:scheduled-filters') || '{}'))).toEqual({
    gender: 'MALE',
  });
});
