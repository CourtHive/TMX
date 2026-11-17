import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { getTournamentRecord, seedTournament } from '../helpers/seed';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Journey 213 — Add flights offers only the rating systems the event's participants hold (CA 2026-11-17). It offered
 * every system, and defaulted to WTN, for a pool nobody in which holds a WTN.
 */
async function openAddFlights(page: Page, profile: any) {
  const tournamentId = await seedTournament(page, profile);
  const record: any = await getTournamentRecord(page);
  await page.goto(`/#/tournament/${tournamentId}/event/${record.events[0].eventId}`);
  await page.getByRole('button', { name: 'Add flights', exact: true }).click();
  const field = (label: string) => page.locator(`.field:has(.label:text-is("${label}")) select`);
  await expect(field('Flighting Strategy')).toBeVisible({ timeout: 10_000 });
  return field;
}

test.describe('Add flights — rating systems', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('a pool rated by UTR alone is offered UTR, and it is selected', async ({ page }) => {
    const field = await openAddFlights(page, {
      tournamentName: 'Flights UTR E2E',
      tournamentAttributes: { tournamentId: 'e2e-flights-utr-001' },
      participantsProfile: { scaleAllParticipants: true },
      eventProfiles: [
        {
          eventName: 'Open Singles',
          category: { ratingType: 'UTR', ratingMin: 5, ratingMax: 14 },
          participantsProfile: { participantsCount: 16 },
        },
      ],
    });
    const ratingSystem = field('Rating System');
    await expect(ratingSystem.locator('option')).toHaveText(['UTR']);
    await expect(ratingSystem).toHaveValue('UTR');
  });

  test('an unrated pool cannot be flighted by rating: ranking is selected', async ({ page }) => {
    const field = await openAddFlights(page, {
      tournamentName: 'Flights Unrated E2E',
      tournamentAttributes: { tournamentId: 'e2e-flights-unrated-001' },
      eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 16 } }],
    });
    const strategy = field('Flighting Strategy');
    await expect(strategy).toHaveValue('RANKING');
    await expect(strategy.locator('option[value="RATING"]')).toBeDisabled();
    await expect(field('Rating System')).toBeHidden();
  });
});
