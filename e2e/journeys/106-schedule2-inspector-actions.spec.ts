import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 106 — Schedule2 Inspector actions popover.
 *
 * The catalog cannot host this menu and that is the reason the Inspector does.
 * Catalog cards are natively `draggable`, so a press competes with drag
 * initiation, and the catalog rebuilds every card on every state change, which
 * orphans anything anchored to one. The Inspector has one stable target per
 * selection.
 *
 * Seeded as **DOUBLES** deliberately. The offerable-participants rule is the
 * only real decision in this feature — a pair must expand to its two players,
 * because the side label ("Smith/Jones") is neither of them and opens neither
 * card. A singles seed would pass whether or not that expansion works, which is
 * exactly the vacuous-probe shape: the assertion has to be able to fail.
 *
 * The popover's DOM half has no unit coverage — TMX runs vitest without a DOM —
 * so this journey is the only evidence it renders at all.
 */

const SCHEDULE_DATE = todayLocal();

const INSPECTOR = '[data-panel="inspector"]';
const CATALOG_PANEL = '[data-panel="catalog"]';
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';
const CARD = '.spl-matchup-card';
const ACTIONS = '.tmx-inspector-actions';
const TRIGGER = '.tmx-inspector-actions-trigger';
const MENU = '.tmx-inspector-actions-menu';
const ACTION_ROW = '.tmx-inspector-action-row';
// `cModal` (courthive-components) is the participant profile's host, not the
// unrelated `#tmxModal`. Assert on the DIALOG, not the outer `.chc-modal`
// section: `.chc-modal-container` is `position: fixed`, so the section collapses
// to zero height and reads as hidden even while the modal is plainly on screen.
const MODAL = '.chc-modal-dialog';

type Seed = { tournamentId: string; matchUpId: string; individualNames: string[]; pairName: string };

/**
 * A doubles draw with a single unscheduled R1 matchUp identified, plus the four
 * individual names the popover must offer and the pair label it must NOT.
 *
 * Throws rather than falling back if the sides are not hydrated with their
 * members — a seed that stopped producing them would leave the central
 * assertion checking an empty list and passing.
 */
async function seedDoubles(page: import('@playwright/test').Page): Promise<Seed> {
  return page.evaluate(
    async ({ date }) => {
      await dev.tmx2db.initDB();

      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Inspector Actions',
        tournamentAttributes: { tournamentId: 'e2e-inspector-actions', startDate: date, endDate: date },
        drawProfiles: [{ eventName: 'Doubles', drawSize: 8, eventType: 'DOUBLES', drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 2, venueName: 'Actions Venue' }],
      });

      const matchUps = dev.factory.competitionEngine.allTournamentMatchUps({ inContext: true }).matchUps || [];
      const target = matchUps.find(
        (m: any) =>
          m.roundNumber === 1 &&
          m.matchUpStatus !== 'BYE' &&
          (m.sides || []).every((s: any) => s.participant?.individualParticipants?.length === 2),
      );
      if (!target) throw new Error('seed produced no doubles matchUp with hydrated pair members');

      const individualNames = (target.sides || []).flatMap((s: any) =>
        (s.participant.individualParticipants || []).map((i: any) => i.participantName),
      );
      const pairName = target.sides[0].participant.participantName;

      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);

      return {
        tournamentId: tournamentRecord.tournamentId as string,
        matchUpId: target.matchUpId as string,
        individualNames: individualNames as string[],
        pairName: pairName as string,
      };
    },
    { date: SCHEDULE_DATE },
  );
}

test.describe('Journey 106 — Schedule2 Inspector actions', () => {
  let seed: Seed;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    seed = await seedDoubles(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(UNSCHEDULED_TAB).click();
    await page.locator(CATALOG_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator(`${CARD}[data-matchup-id="${seed.matchUpId}"]`).click();
  });

  test('the actions block is a SIBLING of the rest section, not a child of it', async ({ page }) => {
    // The structural guarantee behind the whole design: the rest section calls
    // replaceChildren() on itself every 30 seconds, which would destroy an open
    // popover mid-interaction. Asserted structurally because waiting out a
    // 30-second tick in a journey would be both slow and flaky.
    await expect(page.locator(`${INSPECTOR} ${ACTIONS}`)).toBeVisible();
    await expect(page.locator(`${INSPECTOR} .tmx-rest ${ACTIONS}`)).toHaveCount(0);
  });

  test('the trigger opens a popover offering the draw and every individual', async ({ page }) => {
    await page.locator(`${INSPECTOR} ${TRIGGER}`).click();

    const menu = page.locator(MENU);
    await expect(menu).toBeVisible();
    await expect(menu.locator(ACTION_ROW)).toHaveCount(seed.individualNames.length + 1);

    const labels = await menu.locator(ACTION_ROW).evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    for (const name of seed.individualNames) expect(labels).toContain(name);

    // The control: the pair label is not a person and opens no card, so it must
    // NOT appear. Without this the test would pass on a side-label expansion.
    expect(labels).not.toContain(seed.pairName);
  });

  test('choosing a participant opens their card and dismisses the popover', async ({ page }) => {
    await page.locator(`${INSPECTOR} ${TRIGGER}`).click();
    await page.locator(MENU).getByText(seed.individualNames[0], { exact: true }).click();

    await expect(page.locator(MODAL)).toBeVisible();
    await expect(page.locator(MODAL)).toContainText(seed.individualNames[0]);
    await expect(page.locator(MENU)).toHaveCount(0);
  });

  test('choosing the draw navigates to the structure view', async ({ page }) => {
    await page.locator(`${INSPECTOR} ${TRIGGER}`).click();
    await page.locator(`${MENU} ${ACTION_ROW}`).first().click();

    await expect(page).toHaveURL(/\/event\/[^/]+\/draw\//);
    await expect(page.locator(MENU)).toHaveCount(0);
  });

  test('no unresolved i18n key reaches the operator', async ({ page }) => {
    await page.locator(`${INSPECTOR} ${TRIGGER}`).click();

    const text = (await page.locator(MENU).innerText()).trim();
    expect(text).not.toBe('');
    // `t()` echoes its key when it resolves to nothing; a dotted path in
    // rendered copy is the signature.
    expect(text).not.toMatch(/schedule\.inspector\.actions/);
    expect(text).not.toContain('{{');
  });
});
