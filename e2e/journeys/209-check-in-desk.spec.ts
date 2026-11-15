/**
 * Journey 209 — the Check-In desk's filters and cards (CA 2026-11-15, TMX #2005 / #2007).
 *
 * The desk is DOM the unit suite cannot reach (vitest runs in node), so its contract lives here:
 *   - the status chips are the matchUps table's: the desk opens on "To be played", so a match with a score is off
 *     the desk until its chip asks for it, and each chip counts the cards it would show
 *   - search and the filter popover are the standard controls; the popover offers check-in state, event and venue.
 *     The popover drops a section that has no options when it is made, which once hid event and venue entirely
 *   - a person's line leads with the check-in mark: "○ Side 1: Name", a partner's name aligned beneath
 *   - names take the gender accents, and the tournament clock sits centred in the fallback footer
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { todayLocal } from '../helpers/dates';

const CARD = '.tmx-checkin-card';
const CHIP = '.tmx-checkin-status-chips button';
const LINE = '.tmx-checkin-person-line';

async function seedDesk(page: Page): Promise<{ url: string; liveMatchUpId: string }> {
  return page.evaluate(async (today) => {
    const { mocksEngine, tournamentEngine: engine } = dev.factory;
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({
      startDate: today,
      endDate: today,
      drawProfiles: [
        { drawSize: 4, gender: 'FEMALE', eventName: 'Womens Singles' },
        { drawSize: 2, eventType: 'DOUBLES', gender: 'MIXED', eventName: 'Mixed Doubles' },
      ],
      venueProfiles: [{ courtsCount: 4, venueName: 'Central Park' }],
      // a zone the test browser is not in, so the tournament clock shows
      tournamentAttributes: { tournamentId: 'e2e-check-in-desk', localTimeZone: 'Pacific/Kiritimati' },
      nonRandom: 1,
    });
    engine.setState(tournamentRecord);
    const { matchUps } = engine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } });
    engine.scheduleMatchUps({ scheduleDate: today, matchUpIds: matchUps.map((m: any) => m.matchUpId) });
    const singles = matchUps.filter((m: any) => m.matchUpType === 'SINGLES');
    const [live, done] = singles;
    const outcome = (scoreString: string, winningSide?: number, matchUpStatus?: string) =>
      mocksEngine.generateOutcomeFromScoreString({ scoreString, winningSide, matchUpStatus }).outcome;
    engine.setMatchUpStatus({
      drawId: live.drawId,
      matchUpId: live.matchUpId,
      outcome: outcome('6-3 3-3', undefined, 'IN_PROGRESS'),
    });
    engine.setMatchUpStatus({ drawId: done.drawId, matchUpId: done.matchUpId, outcome: outcome('6-1 6-1', 1) });
    const record = engine.getTournament().tournamentRecord;
    await dev.load(record);
    return { url: `/#/tournament/${record.tournamentId}/scheduling/${today}/check-in`, liveMatchUpId: live.matchUpId };
  }, todayLocal());
}

/** A chip's label and count, as the footer of the matchUps table shows them. */
async function chips(page: Page): Promise<Record<string, { on: boolean; count: string }>> {
  return page
    .locator(CHIP)
    .evaluateAll((buttons) =>
      Object.fromEntries(
        buttons.map((button: any) => [
          button.dataset.value,
          { on: button.dataset.on === 'true', count: button.lastElementChild?.textContent ?? '' },
        ]),
      ),
    );
}

/** The computed colour a theme token resolves to, for comparing against a name's colour. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${value})`;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

test.describe('Journey 209 — the Check-In desk', () => {
  let seeded: { url: string; liveMatchUpId: string };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    seeded = await seedDesk(page);
    await page.goto(seeded.url);
    await expect(page.locator(CARD).first()).toBeVisible({ timeout: 15_000 });
  });

  test('opens on matches to be played; a scored match waits for its chip', async ({ page }) => {
    // 2 singles + 1 doubles first-round matches; one singles is live, one is complete
    await expect(page.locator(CARD)).toHaveCount(1);
    expect(await chips(page)).toEqual({
      toBePlayed: { on: true, count: '1' },
      live: { on: false, count: '1' },
      suspended: { on: false, count: '0' },
      complete: { on: false, count: '1' },
    });
    await expect(page.locator(`${CARD}[data-match-up-id="${seeded.liveMatchUpId}"]`)).toHaveCount(0);

    await page.locator(CHIP, { hasText: 'Live' }).click();
    await expect(page.locator(CARD)).toHaveCount(2);
    await expect(page.locator(`${CARD}[data-match-up-id="${seeded.liveMatchUpId}"]`)).toHaveCount(1);
  });

  test('the filter popover offers check-in state, event and venue, and an event narrows the desk', async ({ page }) => {
    await page.locator(CHIP, { hasText: 'Live' }).click();
    await expect(page.locator(CARD)).toHaveCount(2);

    await page.locator('#filterPopoverButton').click();
    const labels = page.locator('.filter-popover-row .filter-popover-label');
    await expect(labels).toHaveText(['Check-in status', 'All events', 'All venues']);

    const event = page.locator('.filter-popover-row', { hasText: 'All events' }).locator('select');
    await event.selectOption({ label: 'Mixed Doubles' });
    await expect(page.locator(CARD)).toHaveCount(1);
    await expect(page.locator(CARD)).toContainText('Mixed Doubles');
  });

  test('each line leads with the mark, names a side once, and takes the gender accent', async ({ page }) => {
    const doubles = page.locator(CARD, { hasText: 'Mixed Doubles' });
    const lines = doubles.locator(LINE);
    await expect(lines).toHaveCount(4);

    const first = lines.first().locator(':scope > span');
    await expect(first.nth(0)).toHaveClass(/tmx-checkin-mark/);
    await expect(first.nth(0)).toHaveText('○');
    await expect(first.nth(1)).toHaveText('Side 1:');
    // the partner's line keeps the side column, empty, so the two names align
    await expect(lines.nth(1).locator('.tmx-checkin-side-label')).toHaveText('');
    await expect(lines.nth(2).locator('.tmx-checkin-side-label')).toHaveText('Side 2:');

    const pink = await tokenColor(page, '--tmx-accent-pink');
    const purple = await tokenColor(page, '--tmx-accent-purple');
    // both singles matches are scored, so the live one is shown first
    await page.locator(CHIP, { hasText: 'Live' }).click();
    const singlesName = page.locator(CARD, { hasText: 'Womens Singles' }).first().locator(`${LINE} > span`).nth(2);
    await expect(singlesName).toHaveCSS('color', pink);
    await expect(doubles.locator('.tmx-checkin-event')).toHaveCSS('color', purple);
  });

  test('the tournament clock sits centred in the fallback footer', async ({ page }) => {
    // The time itself, not its panel: uncentred, the panel stretches to the bar's full height (equal gaps of 0)
    // while the time sits at its top, which is the quirk CA saw.
    const time = page.locator('.tmx-tournament-clock output');
    await expect(time).toBeVisible();
    const gaps = await time.evaluate((output) => {
      const bar = output.closest('footer')!.getBoundingClientRect();
      const box = output.getBoundingClientRect();
      return { top: box.top - bar.top, bottom: bar.bottom - box.bottom };
    });
    expect(Math.abs(gaps.top - gaps.bottom)).toBeLessThanOrEqual(3);
  });
});
