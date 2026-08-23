import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_EMPTY_TOURNAMENT } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 100 — the call sheet, and the multi-contact drawer behind it.
 *
 * This journey carries more weight than most, because TMX has **no jsdom**: the unit suite runs in
 * the vitest `node` environment, so the pure logic (`collectContacts`, `buildCallSheet`,
 * `contactLinks`) is unit-tested and the DOM shell that renders it has no other coverage at all.
 * Everything asserted here is a thing only a browser can answer — that the `tel:` / `sms:` hrefs
 * reach the DOM, that the drawer grows a block per stored contact, and that a private contact is
 * MARKED rather than hidden.
 *
 * That last one is decision **D3 (CA, 2026-08-23)**: the TD surface does not respect
 * `contact.isPublic`. A director sees every contact. `isPublic` governs public surfaces only, and
 * `getTournamentInfo` still filters `tournamentContacts` on it — untouched by this work. The
 * assertion below is written so that HIDING a private contact would fail it, which is the
 * regression D3 exists to prevent.
 */

const ROWS = `${S.TOURNAMENT_PARTICIPANTS} .tabulator-row`;
const PHYSIO_MOBILE = '+1 555 0100';
const PHYSIO_EMERGENCY = '+1 555 0200';

/**
 * Give the first two participants a STAFF role and contact details.
 *
 * Written through the engine rather than the UI because the UI path is what the rest of the journey
 * exercises; seeding it by hand here would make a failure ambiguous between "cannot enter" and
 * "cannot display".
 */
async function seedPersonnel(page: Page): Promise<void> {
  await page.evaluate(
    async ({ mobile, emergency }) => {
      const engine = dev.factory.tournamentEngine;
      const { participants } = engine.getParticipants({
        participantFilters: { participantTypes: ['INDIVIDUAL'] },
      });

      engine.modifyParticipant({
        participant: {
          participantId: participants[0].participantId,
          participantRole: 'PHYSIO',
          person: {
            ...participants[0].person,
            contacts: [
              { mobileTelephone: mobile, emailAddress: 'physio@example.org', relationship: 'SELF', isPublic: true },
              { mobileTelephone: emergency, name: 'Night line', relationship: 'EMERGENCY' },
            ],
          },
        },
      });

      // A second staff member with NO contact details — the third state the call sheet has to
      // distinguish, and the one a summary that only counts reachable people would hide.
      engine.modifyParticipant({
        participant: { participantId: participants[1].participantId, participantRole: 'TRANSPORT' },
      });

      await dev.load(dev.getTournament());
    },
    { mobile: PHYSIO_MOBILE, emergency: PHYSIO_EMERGENCY },
  );
}

async function gotoStaff(page: Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  // The Staff view is its own route (`/participants/:participantView`), so it is reached by URL
  // rather than by the Participants nav tab, which lands on the Competitors view.
  await page.goto(`/#/tournament/${tournamentId}/participants/STAFF`);
  await page.waitForSelector(ROWS, { timeout: 15_000 });
}

test.describe('Journey 100 — participants call sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('the staff row carries tappable tel: and sms: affordances', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    await seedPersonnel(page);
    await gotoStaff(page, tournamentId);

    const cell = page.locator(`${ROWS} .tmx-contact-cell`).first();
    await expect(cell).toBeVisible({ timeout: 10_000 });

    // The dial string, not the text as typed. A `tel:` carrying "+1 555 0100" verbatim does not dial.
    await expect(cell.locator('a[href^="tel:"]')).toHaveAttribute('href', 'tel:+15550100');
    await expect(cell.locator('a[href^="sms:"]')).toHaveAttribute('href', 'sms:+15550100');
    await expect(cell.locator('a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:physio@example.org');

    // The second contact is not rendered in the row — it is announced by the +n marker.
    await expect(cell.locator('.tmx-contact-more')).toHaveText('+1');
  });

  test('the call sheet lists every contact and MARKS the private one (D3)', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    await seedPersonnel(page);
    await gotoStaff(page, tournamentId);

    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByText('Call sheet', { exact: false }).first().click();

    const sheet = page.locator('.tmx-call-sheet');
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    // BOTH contacts, not just the primary. This is what the multi-contact half of the work bought.
    const contactLines = sheet.locator('.tmx-call-sheet-contact');
    await expect(contactLines).toHaveCount(2);
    await expect(contactLines.nth(1)).toContainText(PHYSIO_EMERGENCY);

    // D3, stated as an assertion. The private contact is PRESENT and MARKED. A regression that
    // hid it would fail the count above; one that dropped the marker fails here.
    await expect(sheet.locator('.tmx-contact-private-mark')).toHaveCount(1);

    // The person with no contact details still appears — a sheet that omits them claims the roster
    // is complete — and reads as an outstanding task rather than a row to act on.
    await expect(sheet.locator('.tmx-call-sheet-entry.is-muted')).toHaveCount(1);
    await expect(sheet.locator('.tmx-call-sheet-summary')).toContainText('1 without contact details');
  });

  test('the drawer renders one block per stored contact, plus a spare', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    await seedPersonnel(page);
    await gotoStaff(page, tournamentId);

    await page.locator(`${ROWS} .fa-ellipsis-vertical`).first().click();
    await page.getByText('Edit Participant', { exact: false }).first().click();

    // Two stored contacts → two blocks → plus the blank spare that IS the add affordance.
    //
    // Counted, never asserted VISIBLE: `is-checkradio` hides the real <input> and paints the label,
    // so `toBeVisible` reports "hidden" for a checkbox the director can plainly see and click.
    const drawer = page.locator(S.TMX_DRAWER);
    await expect(drawer.locator('input[id^="contactIsPublic"]')).toHaveCount(3, { timeout: 10_000 });

    // The stored values reach their own block rather than all collapsing onto the primary.
    await expect(drawer.locator('#mobileTelephone')).toHaveValue(PHYSIO_MOBILE);
    await expect(drawer.locator('#mobileTelephone_1')).toHaveValue(PHYSIO_EMERGENCY);
    await expect(drawer.locator('#mobileTelephone_2')).toHaveValue('');

    // With more than one stored contact the primary picker appears — reorder is how the primary is
    // set, because the primary is positional (`contacts[0]`) and not a stored marker.
    await expect(drawer.locator('#primaryContact input[type="radio"]')).toHaveCount(2);
  });
});
