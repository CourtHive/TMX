import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { daysFromTodayLocal } from '../helpers/dates';
import { S } from '../helpers/selectors';

/**
 * Journey 218 — the participants footer follows every route a participant can arrive by.
 *
 * The footer's counts are a view over the table, so the guarantee is only as good as the events it repaints on.
 * Each route below ends differently, and each was checked to reach the footer:
 *
 *   - generated participants, a manual add, a CSV import: a local mutation, then `replaceTableData` (dataProcessed)
 *   - another director's mutation: the remote-apply handler, then `context.refreshActiveTable` (dataProcessed)
 *   - the sign-in cell: `cell.setValue`, an in-place edit that fires ONLY dataChanged. The footer missed this until
 *     it listened for dataChanged; removing that listener fails the sign-in step here.
 *
 * The tournament has no age categories, so the age chips are decades, and a decade nobody is in is hidden. The 60+
 * chip therefore starts hidden and must APPEAR when a participant born in 1955 arrives: chip visibility is judged on
 * every paint, not fixed when the footer was built.
 *
 * Dates are around today on purpose: TMX refuses a local mutation outside the tournament's dates ("Not in date
 * range"), which would leave every local route adding nothing.
 */

const FOOTER = '.tmx-participants-footer';
const INDIVIDUALS = { participantFilters: { participantTypes: ['INDIVIDUAL'] } };

async function seed(page: Page): Promise<string> {
  const dates = { startDate: daysFromTodayLocal(-1), endDate: daysFromTodayLocal(3) };
  return page.evaluate(async ({ startDate, endDate }) => {
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      tournamentName: 'E2E Footer Routes',
      tournamentAttributes: { tournamentId: 'e2e-footer-routes', startDate, endDate },
      drawProfiles: [{ eventName: 'Open Singles', drawSize: 16 }],
    });
    // everyone in their twenties or thirties: no 60+ yet
    tournamentRecord.participants.forEach((p: any, i: number) => {
      if (p.person) p.person.birthDate = `${1990 + (i % 10)}-05-05`;
    });
    await dev.load(tournamentRecord);
    return tournamentRecord.tournamentId;
  }, dates);
}

const chip = (page: Page, value: string) => page.locator(`${FOOTER} [data-value="${value}"]`);
const count = async (page: Page, value: string) =>
  Number(await chip(page, value).locator('.tmx-status-strip-count').innerText());
const individuals = (page: Page) =>
  page.evaluate((args) => dev.factory.tournamentEngine.getParticipants(args).participants.length, INDIVIDUALS);
const shown = (page: Page) => page.locator(`${FOOTER} .tmx-participants-footer-scope`);

test.describe('Journey 218 — participants footer follows every add route', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('generated, manual, imported, signed-in and remote participants all reach the footer', async ({ page }) => {
    const tournamentId = await seed(page);
    await page.goto(`/#/tournament/${tournamentId}/participants`);
    await page.locator(`${S.TOURNAMENT_PARTICIPANTS} .tabulator-row`).first().waitFor();
    await expect(shown(page)).toHaveText('16 shown');
    await expect(chip(page, 'age:60+')).toBeHidden();

    // generated participants: the control bar's button and its modal, at its default count
    await page.getByText('Generate mock participants', { exact: true }).click();
    await page
      .locator('button', { hasText: /^Generate$/ })
      .last()
      .click();
    await expect.poll(() => individuals(page)).toBe(48);
    await expect(shown(page)).toHaveText('48 shown');
    await expect.poll(() => count(page, 'unentered')).toBe(32);

    // manual add, with no DOB
    await page.getByText('Actions', { exact: true }).first().click();
    await page.getByText('New participant', { exact: true }).click();
    const field = (label: string) => page.locator(`.field:has(label:text-is("${label}")) input`).first();
    await field('First name').fill('Manual');
    await field('Last name').fill('Entry');
    await page
      .locator('button', { hasText: /^Save$/ })
      .last()
      .click();
    await expect(shown(page)).toHaveText('49 shown');
    await expect.poll(() => count(page, 'noDob')).toBe(33);

    // CSV import: the import view importPlayersCsv opens once a file is dropped, with the same refresh callback
    // module paths go in as data: the browser (Vite) resolves them, the e2e tsconfig never has to
    await page.evaluate(
      async ({ csv, modules }) => {
        const { openImportParticipantsView } = await import(modules.importView);
        const { parseDelimited } = await import(modules.parseDelimited);
        const { context } = await import(modules.context);
        const { headers, rows } = parseDelimited(csv);
        openImportParticipantsView({ headers, rows, callback: () => context.refreshActiveTable?.() });
      },
      {
        csv: 'First Name,Last Name,Gender,Birth Date\nCsv,Veteran,F,1955-02-02\nCsv,Young,M,1995-02-02\n',
        modules: {
          importView: '/src/components/modals/importParticipantsView.ts',
          parseDelimited: '/src/services/import/parseDelimited.ts',
          context: '/src/services/context.ts',
        },
      },
    );
    await page
      .locator('button', { hasText: /^Import$/ })
      .last()
      .click();
    await expect(shown(page)).toHaveText('51 shown');
    await expect(chip(page, 'age:60+')).toBeVisible();
    await expect.poll(() => count(page, 'age:60+')).toBe(1);

    // the sign-in cell: an in-place edit that fires only dataChanged
    await expect.poll(() => count(page, 'signedIn')).toBe(0);
    await page
      .locator(`${S.TOURNAMENT_PARTICIPANTS} .tabulator-row .tabulator-cell[tabulator-field="signedIn"]`)
      .first()
      .click();
    await expect.poll(() => count(page, 'signedIn')).toBe(1);

    // another director's mutation, through the real remote-apply handler. Last: a synthetic command carries no
    // server sync stamps, which can leave this desk marked behind, and a desk behind refuses local writes
    await page.evaluate(() =>
      dev.simulateTournamentMutation({
        tournamentIds: ['e2e-footer-routes'],
        userId: 'another-director',
        methods: [
          {
            method: 'addParticipants',
            params: {
              participants: [
                {
                  participantId: 'remote-1',
                  participantType: 'INDIVIDUAL',
                  participantRole: 'COMPETITOR',
                  person: {
                    personId: 'remote-p1',
                    standardGivenName: 'Remote',
                    standardFamilyName: 'Senior',
                    sex: 'MALE',
                    birthDate: '1960-01-01',
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    await expect(shown(page)).toHaveText('52 shown');
    await expect.poll(() => count(page, 'age:60+')).toBe(2);
  });
});
