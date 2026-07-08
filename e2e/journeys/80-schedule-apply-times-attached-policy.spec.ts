import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 80 — Apply Times: attached scheduling policy is the default, re-apply
 * is a no-op, and switching policies replaces (allowReplacement).
 *
 * The Apply Times modal pre-selects the policy already attached to the
 * tournament as a first-class "Attached" entry. Confirming without changing it
 * must NOT re-attach (no `attachPolicies` mutation) — it only runs
 * `scheduleProfileRounds`. Picking a *different* policy must attach it with
 * `allowReplacement: true` (the fix for `ERR_EXISTING_POLICY_TYPE`).
 *
 * The pure selection/identity logic is unit-tested in
 * `schedulingPolicyChoices.test.ts`; this journey pins the DOM + mutation wiring
 * end to end. jsdom/happy-dom are not introduced — Playwright is the ecosystem's
 * DOM test layer.
 */

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);

const PROFILE_MODE = 'button[title="Profile"]';
const APPLY_TIMES_BTN = 'button[title^="Apply Times —"]';
const MODAL = '.chc-modal';
const POLICY_SELECT = `${MODAL} select`;
const ATTACHED_ID = '__attached__';
const BUILTIN_SCHEDULING_ID = 'builtin-scheduling';

/**
 * Seed an 8-draw SE event with a venue, ATTACH a scheduling policy, and set a
 * scheduling profile that plans round 1 onto the venue for the date — so the
 * Profile view's Day Plan has planned rounds and Apply Times can run. Bundled
 * into one page.evaluate so the IDB write can't race the seed load.
 */
async function seedWithProfileAndPolicy(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(async (date: string) => {
    try {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Apply Times Attached',
        tournamentAttributes: { tournamentId: 'e2e-apply-times-attached', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 8 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 2, venueName: 'Attached Venue' }],
      });

      const te = dev.factory.tournamentEngine;

      // Attach a (custom) scheduling policy so the modal has an "Attached" entry.
      te.attachPolicies({
        policyDefinitions: { scheduling: { defaultDailyLimits: { SINGLES: 2, DOUBLES: 2, total: 3 } } },
        allowReplacement: true,
      });

      // Plan round 1 onto the venue for the date → Day Plan has planned rounds.
      const event = tournamentRecord.events[0];
      const draw = event.drawDefinitions[0];
      const structureId = draw.structures[0].structureId;
      const venueId = tournamentRecord.venues[0].venueId;
      te.setSchedulingProfile({
        schedulingProfile: [
          {
            scheduleDate: date,
            venues: [
              {
                venueId,
                rounds: [
                  {
                    tournamentId: tournamentRecord.tournamentId,
                    eventId: event.eventId,
                    drawId: draw.drawId,
                    structureId,
                    roundNumber: 1,
                  },
                ],
              },
            ],
          },
        ],
      });

      await dev.tmx2db.addTournament(te.getTournament().tournamentRecord);
      return tournamentRecord.tournamentId as string;
    } catch (err: any) {
      throw new Error(`${err?.name || 'Error'}: ${err?.message || String(err)}`);
    }
  }, SCHEDULE_DATE);
}

async function openProfileMode(page: import('@playwright/test').Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  await page.locator(PROFILE_MODE).click();
  // Day Plan header renders the Apply Times action once the profile view mounts.
  await expect(page.locator(APPLY_TIMES_BTN)).toBeVisible();
}

async function openApplyTimesModal(page: import('@playwright/test').Page): Promise<void> {
  await page.locator(APPLY_TIMES_BTN).click();
  await expect(page.locator(`${MODAL} .chc-modal-title`)).toContainText('Apply Times');
  await expect(page.locator(POLICY_SELECT)).toBeVisible();
}

test.describe('Journey 80 — Apply Times attached policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('attached policy is the default and re-applying does not re-attach', async ({ page }) => {
    const tournamentId = await seedWithProfileAndPolicy(page);
    await openProfileMode(page, tournamentId);

    const collector = createMutationCollector(page);
    await openApplyTimesModal(page);

    // The attached policy is pre-selected as the "Attached" entry.
    await expect(page.locator(POLICY_SELECT)).toHaveValue(ATTACHED_ID);

    // Apply without changing the selection → schedules but does NOT re-attach.
    await page.locator(MODAL).getByRole('button', { name: 'Apply', exact: true }).click();
    await collector.waitForMethod('scheduleProfileRounds');
    expect(collector.hasMethod('attachPolicies')).toBe(false);

    collector.detach();
  });

  test('choosing a different policy attaches it with allowReplacement', async ({ page }) => {
    const tournamentId = await seedWithProfileAndPolicy(page);
    await openProfileMode(page, tournamentId);

    const collector = createMutationCollector(page);
    await openApplyTimesModal(page);

    // Switch from the attached policy to a built-in one → must replace.
    await page.locator(POLICY_SELECT).selectOption(BUILTIN_SCHEDULING_ID);
    await page.locator(MODAL).getByRole('button', { name: 'Apply', exact: true }).click();

    const attach = await collector.waitForMethod('attachPolicies');
    const attachMethod = attach.methods.find((m) => m.method === 'attachPolicies');
    expect((attachMethod?.params as any)?.allowReplacement).toBe(true);
    await collector.waitForMethod('scheduleProfileRounds');

    collector.detach();
  });
});
