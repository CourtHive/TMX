/**
 * Journey 8 — Draw form: Validation and edge cases
 *
 * Tests name validation, generate button state, seeding policy options,
 * second draw creation, and draw size field behavior.
 *
 * @see Test matrix sections 6 (validation), 8 (creation constraints)
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

const PROFILE_16_ENTRIES: MockProfile = {
  tournamentName: 'E2E Validation',
  tournamentAttributes: { tournamentId: 'e2e-validation' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

async function seedAndOpenDrawForm(page: any): Promise<DrawFormDrawer> {
  const tournamentId = await seedTournament(page, PROFILE_16_ENTRIES);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();
  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  return drawer;
}

test.describe('Journey 8 — Draw form validation and edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  /* ── Section 6: Name validation ───────────────────────────────────── */

  test('6.5 — short draw name prevents draw generation', async ({ page }) => {
    const collector = createMutationCollector(page);
    const drawer = await seedAndOpenDrawForm(page);

    // Set the draw name to something too short via evaluate
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('#tmxDrawer input.input');
      // The draw name input is the one with focus (first text input in the form)
      const nameInput = inputs[0] as HTMLInputElement;
      if (nameInput) {
        nameInput.value = 'AB';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Click generate
    await drawer.clickGenerate();

    // Wait a moment for any async processing
    await page.waitForTimeout(1000);

    // Verify no addDrawDefinition mutation was emitted
    expect(collector.hasMethod('addDrawDefinition')).toBe(false);

    collector.detach();
    await drawer.clickCancel();
  });

  /* ── Seeding policy options ───────────────────────────────────────── */

  test('seeding policy shows SEPARATE and CLUSTER options', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page);

    const policySelect = drawer.fieldSelect('Seeding policy');
    const options = await policySelect.locator('option').evaluateAll(
      (opts: HTMLOptionElement[]) => opts.map((o) => o.value),
    );

    // Should have SEPARATE (USTA) and CLUSTER (ITF) at minimum
    expect(options).toContain('SEPARATE');
    expect(options).toContain('CLUSTER');

    await drawer.clickCancel();
  });

  test('seeding policy hidden for AD_HOC, returns for SE', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page);

    // Start at SE — seeding policy visible
    await drawer.expectFieldVisible('Seeding policy');

    // Switch to AD_HOC — seeding policy hidden
    await drawer.selectDrawType('AD_HOC');
    await drawer.expectFieldHidden('Seeding policy');

    // Switch back to SE — seeding policy visible again
    await drawer.selectDrawType('SINGLE_ELIMINATION');
    await drawer.expectFieldVisible('Seeding policy');

    await drawer.clickCancel();
  });

  /* ── Draw size field behavior ─────────────────────────────────────── */

  test('draw size field is editable and shows power-of-2 for SE', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page);

    // Default SE draw size should be 16 (power of 2 of 16 entries)
    const drawSizeInput = drawer.fieldInput('Draw size');
    const initialSize = await drawSizeInput.inputValue();
    expect(Number(initialSize)).toBe(16);

    // Field should be visible and editable
    await drawer.expectFieldVisible('Draw size');

    await drawer.clickCancel();
  });

  /* ── Multiple draws on same event ─────────────────────────────────── */

  test('second draw defaults to "Draw 2" name', async ({ page }) => {
    // First: generate a draw
    const collector = createMutationCollector(page);
    const tournamentId = await seedTournament(page, PROFILE_16_ENTRIES);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });

    // Open and generate first draw
    await page.getByRole('button', { name: 'Add draw' }).click();
    let drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();
    await drawer.setInputValue('Draw name', 'Draw 1');
    await drawer.clickGenerate();
    await collector.waitForMethod('addDrawDefinition', 10_000);

    // Wait for drawer to close and navigation to complete
    await page.waitForTimeout(1000);

    // Navigate back to the entries tab to access "Add draw" again
    await page.locator('#eventTabsBar').getByText('Entries').click();
    await page.waitForTimeout(500);

    // Open drawer for second draw
    await page.getByRole('button', { name: 'Add draw' }).click();
    drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    // The default name should be "Draw 2" (drawsCount + 1)
    const drawName = await drawer.getInputValue('Draw name');
    expect(drawName).toBe('Draw 2');

    await drawer.clickCancel();
    collector.detach();
  });

  /* ── Score format options ─────────────────────────────────────────── */

  test('score format field shows scoring options with SET3 default selected', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page);

    const formatSelect = drawer.fieldSelect('Score format');
    await drawer.expectFieldVisible('Score format');

    // Should have at least a Custom option and standard formats
    const options = await formatSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(1);

    // The default selected format should be SET3-S:6/TB7
    const selectedValue = await formatSelect.inputValue();
    expect(selectedValue).toBe('SET3-S:6/TB7');

    await drawer.clickCancel();
  });
});
