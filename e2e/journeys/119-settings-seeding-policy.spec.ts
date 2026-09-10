import { test, expect } from '@playwright/test';
import { initDevBridge, loginAsSuperAdmin, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 119 — a seeding policy attached to the tournament is what makes national seeding
 * compliance reachable.
 *
 * The mechanism already existed on both ends and connected to nothing in the middle:
 * `seedsCountThresholds` is the factory's extension point for a governing body's seeding depth,
 * courthive-components ships an editor for it, and the `/policies` page persists what that editor
 * produces. But no surface bound one of those policies to a tournament, so the two positioning
 * presets in the draw form — which encode the same drawSize/4 progression as each other — were the
 * only seeding any draw could get.
 *
 * Binding is at the TOURNAMENT, not per draw: every draw in a sanctioned competition seeds by the
 * same rule, including one regenerated later, and the draw form's "Inherited" option already reads
 * a tournament-level policy.
 */

const PANEL = '#seedingPolicyPanel';

async function seedTournament(page: any): Promise<string> {
  return page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Seeding Policy',
      drawProfiles: [{ eventName: 'Singles', drawSize: 32, participantsCount: 32, generate: false }],
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  });
}

async function openSettings(page: any, tournamentId: string) {
  await page.goto(`/#/tournament/${tournamentId}/settings`);
  await page.locator('#tournamentSettings .settings-panel').first().waitFor({ timeout: 15_000 });
}

test('the seeding policy panel attaches a policy to the tournamentRecord', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await loginAsSuperAdmin(page);
  const tournamentId = await seedTournament(page);

  await openSettings(page, tournamentId);
  await expect(page.locator(PANEL)).toHaveCount(1);

  const select = page.locator(`${PANEL} select`);
  await expect(select).toBeVisible();

  // Nothing attached yet, so the explicit "none" entry is what is selected.
  await expect(select).toHaveValue('__none__');

  // The threshold table is the point: a policy's NAME never says how deeply it seeds.
  await select.selectOption('builtin-seeding');
  await expect(page.locator(`${PANEL} div`).filter({ hasText: '32 →' }).first()).toBeVisible();

  await page.locator(`${PANEL} button`).click();

  // The attached policy comes back as a first-class entry, so re-saving is a no-op rather than a
  // churning re-attach.
  await expect(select).toHaveValue('__attached__', { timeout: 10_000 });
  await expect(select.locator('option[value="__attached__"]')).toContainText('Attached —');

  // And it is genuinely on the record, where the draw form's "Inherited" option will find it.
  // Attached policies live in the `appliedPolicies` extension, so read them the way the factory
  // does rather than looking for a `policyDefinitions` property that attachPolicies never writes.
  const attached = await page.evaluate(
    () => dev.factory.tournamentEngine.getPolicyDefinitions({ policyTypes: ['seeding'] })?.policyDefinitions?.seeding,
  );
  expect(attached?.seedsCountThresholds?.length).toBeGreaterThan(0);
});

test('the draw form offers Inherited once a tournament seeding policy is attached', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await loginAsSuperAdmin(page);
  const tournamentId = await seedTournament(page);

  await openSettings(page, tournamentId);
  await page.locator(`${PANEL} select`).selectOption('builtin-seeding');
  await page.locator(`${PANEL} button`).click();
  await expect(page.locator(`${PANEL} select`)).toHaveValue('__attached__', { timeout: 10_000 });

  await page.goto(`/#/tournament/${tournamentId}/events`);
  await page.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();

  const seedingSelect = page.locator('.drawer .field:has(.label:text-is("Seeding policy"))').locator('select');
  await expect(seedingSelect).toBeVisible({ timeout: 10_000 });
  // "Inherited" is the compliance path — it is what defers to the tournament policy.
  await expect(seedingSelect.locator('option')).toContainText(['Inherited']);
  await expect(seedingSelect).toHaveValue('INHERIT');
});
