import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { daysFromTodayLocal } from '../helpers/dates';
import { S } from '../helpers/selectors';

/**
 * Journey 221 — an event created from selected participants, and the categories a tournament defines.
 *
 * Reported against the CourtHive Challenge example: selecting players and choosing "Create event" preselected
 * "18 and Under", Save then failed with a bare "Invalid participants", and the Overview said the tournament had no
 * categories while its events named some. Three things were wrong, and this journey holds each:
 *
 *   - the dialog took a category from a ranking every selected player shared (SCALE.RANKING.SINGLES.U18). It now
 *     preselects none: the players below all carry that ranking, and the category starts empty.
 *   - `U18` is "under 18" (17 at most) as the factory enforces it, but was labelled "18 and Under". The option now
 *     reads "Under 18", and the two 18-year-olds below are refused by it
 *     (18 is exactly the age the two readings disagree on).
 *   - the refusal named who and why, and the create path dropped it. The Invalid Participants modal now lists the
 *     refused players, and the refused queue leaves no event behind.
 *
 * The categories editor states each category's rule and lists the event categories the tournament does not define,
 * with a way to define them.
 *
 * Birth dates are set explicitly rather than generated, and dates are around today (TMX refuses a local mutation
 * outside the tournament's dates).
 */

const startDate = daysFromTodayLocal(-1);
const endDate = daysFromTodayLocal(3);
const thisYear = Number(startDate.slice(0, 4));
// 18 on every date of the start's year: admitted by "18 and Under", refused by under-18 (17 at most); and 13
const EIGHTEEN = `${thisYear - 18}-01-01`;
const THIRTEEN = `${thisYear - 13}-06-30`;

async function seedSelection(page: Page): Promise<string> {
  return page.evaluate(
    async ({ startDate, endDate, EIGHTEEN, THIRTEEN }) => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        tournamentName: 'E2E Category From Selection',
        tournamentAttributes: { tournamentId: 'e2e-category-from-selection', startDate, endDate },
        participantsProfile: { participantsCount: 4, sex: 'MALE' },
      });
      tournamentRecord.participants.forEach((p: any, i: number) => {
        p.person.birthDate = i < 2 ? EIGHTEEN : THIRTEEN;
        // the ranking the dialog used to read a category from
        p.timeItems = [{ itemType: 'SCALE.RANKING.SINGLES.U18', itemValue: i + 1 }];
      });
      await dev.load(tournamentRecord);
      return tournamentRecord.tournamentId;
    },
    { startDate, endDate, EIGHTEEN, THIRTEEN },
  );
}

async function seedUndefinedCategory(page: Page): Promise<string> {
  return page.evaluate(
    async ({ startDate, endDate }) => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        tournamentName: 'E2E Undefined Category',
        tournamentAttributes: { tournamentId: 'e2e-undefined-category', startDate, endDate },
        drawProfiles: [
          { eventName: 'U16 Singles', category: { categoryName: 'U16', ageCategoryCode: 'U16' }, drawSize: 4 },
        ],
      });
      delete tournamentRecord.tournamentCategories;
      await dev.load(tournamentRecord);
      return tournamentRecord.tournamentId;
    },
    { startDate, endDate },
  );
}

const eventsCount = (page: Page) => page.evaluate(() => dev.getTournament().events?.length ?? 0);
const categorySelect = (page: Page) => page.locator('select:has(option[value="U18"])').first();

test.describe('Journey 221 — event category from a selection, and the tournament categories', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('no category is guessed; a refused entry names who and why and leaves no event', async ({ page }) => {
    const tournamentId = await seedSelection(page);
    await page.goto(`/#/tournament/${tournamentId}/participants`);
    const rows = page.locator(`${S.TOURNAMENT_PARTICIPANTS} .tabulator-row`);
    await expect(rows).toHaveCount(4);
    // the header's select-all checkbox (a rowSelection column)
    await page.locator(`${S.TOURNAMENT_PARTICIPANTS} .tabulator-col input[type="checkbox"]`).first().check();
    await expect(page.getByText('Selected: 4', { exact: true })).toBeVisible();

    await page.getByText('Create event', { exact: true }).click();
    await expect(categorySelect(page)).toBeVisible();

    // every selected player ranks in U18, and still no category is chosen for them
    await expect(categorySelect(page)).toHaveValue('');
    await expect(categorySelect(page).locator('option[value="U18"]')).toHaveText('Under 18');

    await categorySelect(page).selectOption('U18');
    await page
      .locator('button', { hasText: /^Save$/ })
      .last()
      .click();

    // the two 18-year-olds, by name, with the factory's reason
    const modal = page.locator('.chc-modal-dialog').filter({ hasText: 'Invalid Participants' });
    await expect(modal).toBeVisible();
    const names = await page.evaluate(() =>
      dev
        .getTournament()
        .participants.slice(0, 2)
        .map((p: any) => p.participantName),
    );
    for (const name of names) await expect(modal).toContainText(name);
    await expect(modal).toContainText(/max: 17/);

    // the queue was refused whole: no event without its entries
    expect(await eventsCount(page)).toBe(0);
  });

  test("the categories editor states each rule and offers to define an event's undefined category", async ({
    page,
  }) => {
    const tournamentId = await seedUndefinedCategory(page);
    await page.goto(`/#/tournament/${tournamentId}`);
    await page.getByText('Categories (0)', { exact: true }).click();

    const modal = page.locator('.chc-modal-dialog').filter({ hasText: 'Tournament Categories' });
    const undefinedSection = modal.getByText('Used by events, not defined for this tournament');
    await expect(undefinedSection).toBeVisible();
    // the rule the event's category applies, stated on the tournament's start date
    await expect(modal).toContainText(`15 or younger on ${startDate}`);
    await expect(modal).toContainText('U16 is used by: U16 Singles');

    // the event's category has a rule, so Define adds it as the event has it, without the editor
    await modal.getByRole('button', { name: 'Define' }).click();

    // now defined: listed with its rule, in use (so neither editable nor deletable), and no longer undefined
    await expect(undefinedSection).toBeHidden();
    await expect.poll(() => page.evaluate(() => dev.getTournament().tournamentCategories?.length ?? 0)).toBe(1);
    await expect(modal).toContainText(`15 or younger on ${startDate}`);
    await expect(modal.getByRole('button', { name: 'Edit' })).toBeDisabled();
    await expect(modal.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
