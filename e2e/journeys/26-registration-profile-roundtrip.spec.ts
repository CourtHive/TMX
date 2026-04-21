import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_EMPTY_TOURNAMENT } from '../helpers/seed';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';

const MODAL = '.chc-modal-dialog';

/** Helper: locate an input/select/textarea by its label text within a container */
function fieldByLabel(page, container, label: string) {
  return container.locator(`label:has-text("${label}")`).locator('..').locator('input, select, textarea');
}

/** Click the [+ Add] button inside a section, wait for the inline form to appear */
async function clickAddInSection(page, sectionKey: string) {
  const section = page.locator(MODAL).locator(`[data-section="${sectionKey}"]`);
  await section.locator('button:has-text("Add")').click();
  // Wait for inline form panel to appear
  await section.locator('input').first().waitFor({ timeout: 3000 });
  return section;
}

/** Fill a field in the inline form by label */
async function fillInlineField(section, label: string, value: string) {
  const field = section.locator(`label:has-text("${label}")`).locator('..').locator('input, select, textarea');
  const tagName = await field.evaluate((el) => el.tagName.toLowerCase());
  if (tagName === 'select') {
    await field.selectOption(value);
  } else {
    await field.fill(value);
  }
}

/** Click Save in the inline form */
async function saveInlineForm(section) {
  await section.locator('button:has-text("Save")').click();
}

test.describe('Journey 26 — Registration Profile Round-Trip', () => {
  let tournamentId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
  });

  test('all fields round-trip through save and reopen', async ({ page }) => {
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToOverview();

    const modal = page.locator(MODAL);

    // --- Open the registration profile editor ---
    await page.locator('button[title="Edit Registration Profile"]').click();
    await modal.waitFor({ timeout: 5000 });

    // --- Entry & Eligibility ---
    await fieldByLabel(page, modal, 'Entries Open').fill('2026-06-01');
    await fieldByLabel(page, modal, 'Entries Close').fill('2026-06-15');
    await fieldByLabel(page, modal, 'Withdrawal Deadline').fill('2026-06-10');
    await fieldByLabel(page, modal, 'Entry Method').selectOption('ONLINE');
    await fieldByLabel(page, modal, 'Entry URL').fill('https://register.example.com');
    await fieldByLabel(page, modal, 'Eligibility Notes').fill('Must be 18+');

    // --- Accommodation (logistics) ---
    const accomSection = await clickAddInSection(page, 'accommodation');
    await fillInlineField(accomSection, 'Name', 'Grand Hotel');
    await fillInlineField(accomSection, 'Phone', '+1-555-0100');
    await fillInlineField(accomSection, 'Email', 'info@grandhotel.com');
    await fillInlineField(accomSection, 'Address', '123 Main St');
    await fillInlineField(accomSection, 'Price Range', '$150-250/night');
    await fillInlineField(accomSection, 'URL', 'https://grandhotel.com');
    await saveInlineForm(accomSection);

    // Verify the item appeared in the list
    await expect(accomSection.locator('text=Grand Hotel')).toBeVisible();

    // Fill accommodation notes
    await fieldByLabel(page, modal, 'Additional notes').first().fill('<p>Ask for tournament rate</p>');

    // --- Transportation (logistics) ---
    const transSection = await clickAddInSection(page, 'transportation');
    await fillInlineField(transSection, 'Name', 'Airport Shuttle');
    await fillInlineField(transSection, 'Phone', '+1-555-0200');
    await fillInlineField(transSection, 'Email', 'shuttle@airport.com');
    await fillInlineField(transSection, 'Address', 'Terminal B pickup');
    await fillInlineField(transSection, 'Price Range', '$25 each way');
    await fillInlineField(transSection, 'URL', 'https://shuttle.example.com');
    await saveInlineForm(transSection);
    await expect(transSection.locator('text=Airport Shuttle')).toBeVisible();

    // --- Hospitality (logistics) ---
    const hospSection = await clickAddInSection(page, 'hospitality');
    await fillInlineField(hospSection, 'Name', 'Player Lounge');
    await fillInlineField(hospSection, 'Phone', '+1-555-0300');
    await fillInlineField(hospSection, 'Email', 'lounge@club.com');
    await fillInlineField(hospSection, 'Address', 'Court Level, Building A');
    await fillInlineField(hospSection, 'Price Range', 'Complimentary');
    await fillInlineField(hospSection, 'URL', 'https://club.com/lounge');
    await saveInlineForm(hospSection);
    await expect(hospSection.locator('text=Player Lounge')).toBeVisible();

    // --- Medical (logistics) ---
    const medSection = await clickAddInSection(page, 'medical');
    await fillInlineField(medSection, 'Name', 'On-Site Physio');
    await fillInlineField(medSection, 'Phone', '+1-555-0400');
    await fillInlineField(medSection, 'Email', 'physio@tournament.com');
    await fillInlineField(medSection, 'Address', 'Medical Room 1');
    await fillInlineField(medSection, 'Price Range', 'Free for players');
    await fillInlineField(medSection, 'URL', 'https://physio.example.com');
    await saveInlineForm(medSection);
    await expect(medSection.locator('text=On-Site Physio')).toBeVisible();

    // --- Other Details ---
    await fieldByLabel(page, modal, 'Dress Code').fill('All white required');
    await fieldByLabel(page, modal, 'Contingency Plan').fill('Rain delay: indoor courts available');

    // --- Ceremonies & Social ---
    await fieldByLabel(page, modal, 'Draw Ceremony Date').fill('2026-06-16T18:00');
    await fieldByLabel(page, modal, 'Awards Ceremony Date').fill('2026-06-22T16:00');
    await fieldByLabel(page, modal, 'Awards Description').fill('Trophies and prize money presentation');

    // Social Event
    const socialSection = await clickAddInSection(page, 'social-events');
    await fillInlineField(socialSection, 'Event Name', 'Welcome Dinner');
    await fillInlineField(socialSection, 'Date', '2026-06-16');
    await fillInlineField(socialSection, 'Time', '19:30');
    await fillInlineField(socialSection, 'Location', 'Clubhouse Terrace');
    await fillInlineField(socialSection, 'Description', 'Formal attire requested');
    await saveInlineForm(socialSection);
    await expect(socialSection.locator('text=Welcome Dinner')).toBeVisible();

    // --- Sponsors ---
    const sponsorSection = await clickAddInSection(page, 'sponsors');
    await fillInlineField(sponsorSection, 'Sponsor Name', 'Acme Corp');
    await fillInlineField(sponsorSection, 'Tier', 'TITLE');
    await fillInlineField(sponsorSection, 'Website URL', 'https://acme.com');
    await saveInlineForm(sponsorSection);
    await expect(sponsorSection.locator('text=Acme Corp')).toBeVisible();

    // --- Regulations ---
    await fieldByLabel(page, modal, 'Code of Conduct').first().fill('ITF Code of Conduct');
    await fieldByLabel(page, modal, 'Code of Conduct URL').fill('https://itf.com/coc');

    // --- Save the profile ---
    const collector = createMutationCollector(page);
    await modal.locator('button:has-text("Save")').click();

    // Verify mutation was fired
    await collector.waitForMethod('setRegistrationProfile', 5000);
    expect(collector.hasMethod('setRegistrationProfile')).toBe(true);

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // ===== ROUND TRIP: Reopen and verify all fields persisted =====
    await page.locator('button[title="Edit Registration Profile"]').click();
    await modal.waitFor({ timeout: 5000 });

    // --- Entry & Eligibility ---
    await expect(fieldByLabel(page, modal, 'Entries Open')).toHaveValue('2026-06-01');
    await expect(fieldByLabel(page, modal, 'Entries Close')).toHaveValue('2026-06-15');
    await expect(fieldByLabel(page, modal, 'Withdrawal Deadline')).toHaveValue('2026-06-10');
    await expect(fieldByLabel(page, modal, 'Entry Method')).toHaveValue('ONLINE');
    await expect(fieldByLabel(page, modal, 'Entry URL')).toHaveValue('https://register.example.com');
    await expect(fieldByLabel(page, modal, 'Eligibility Notes')).toHaveValue('Must be 18+');

    // --- Logistics items visible in lists ---
    await expect(modal.locator('text=Grand Hotel')).toBeVisible();
    await expect(modal.locator('text=Airport Shuttle')).toBeVisible();
    await expect(modal.locator('text=Player Lounge')).toBeVisible();
    await expect(modal.locator('text=On-Site Physio')).toBeVisible();

    // --- Logistics detail round-trip (phone/email/priceRange visible in list display) ---
    await expect(modal.locator('text=+1-555-0100')).toBeVisible();
    await expect(modal.locator('text=info@grandhotel.com')).toBeVisible();
    await expect(modal.locator('text=$150-250/night')).toBeVisible();

    // --- Other Details ---
    await expect(fieldByLabel(page, modal, 'Dress Code')).toHaveValue('All white required');
    await expect(fieldByLabel(page, modal, 'Contingency Plan')).toHaveValue('Rain delay: indoor courts available');

    // --- Ceremonies ---
    await expect(fieldByLabel(page, modal, 'Draw Ceremony Date')).toHaveValue('2026-06-16T18:00');
    await expect(fieldByLabel(page, modal, 'Awards Ceremony Date')).toHaveValue('2026-06-22T16:00');
    await expect(fieldByLabel(page, modal, 'Awards Description')).toHaveValue('Trophies and prize money presentation');

    // --- Social Events visible ---
    await expect(modal.locator('text=Welcome Dinner')).toBeVisible();
    await expect(modal.locator('text=2026-06-16')).toBeVisible();
    await expect(modal.locator('text=Clubhouse Terrace')).toBeVisible();

    // --- Sponsors visible ---
    await expect(modal.locator('text=Acme Corp')).toBeVisible();
    await expect(modal.locator('text=TITLE')).toBeVisible();

    // --- Regulations ---
    await expect(fieldByLabel(page, modal, 'Code of Conduct').first()).toHaveValue('ITF Code of Conduct');
    await expect(fieldByLabel(page, modal, 'Code of Conduct URL')).toHaveValue('https://itf.com/coc');

    collector.detach();
  });

  test('POSTAL is not an entry method option', async ({ page }) => {
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToOverview();

    await page.locator('button[title="Edit Registration Profile"]').click();
    const modal = page.locator(MODAL);
    await modal.waitFor({ timeout: 5000 });

    const methodSelect = fieldByLabel(page, modal, 'Entry Method');
    const options = await methodSelect.locator('option').allTextContents();
    expect(options).not.toContain('POSTAL');
    expect(options).toContain('ONLINE');
    expect(options).toContain('EMAIL');
    expect(options).toContain('OTHER');
  });

  test('inline form cancel does not add item', async ({ page }) => {
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToOverview();

    await page.locator('button[title="Edit Registration Profile"]').click();
    const modal = page.locator(MODAL);
    await modal.waitFor({ timeout: 5000 });

    // Open accommodation inline form
    const section = await clickAddInSection(page, 'accommodation');
    await fillInlineField(section, 'Name', 'Should Not Appear');

    // Cancel
    await section.locator('button:has-text("Cancel")').click();

    // Item should not be in the list
    await expect(modal.locator('text=Should Not Appear')).not.toBeVisible();

    // Add button should be visible again
    await expect(section.locator('button:has-text("Add")').first()).toBeVisible();
  });

  test('remove button removes item from list', async ({ page }) => {
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToOverview();

    await page.locator('button[title="Edit Registration Profile"]').click();
    const modal = page.locator(MODAL);
    await modal.waitFor({ timeout: 5000 });

    // Add an accommodation item
    const section = await clickAddInSection(page, 'accommodation');
    await fillInlineField(section, 'Name', 'Temp Hotel');
    await saveInlineForm(section);
    await expect(section.locator('text=Temp Hotel')).toBeVisible();

    // Remove it
    await section.locator('.fa-times').first().click();
    await expect(section.locator('text=Temp Hotel')).not.toBeVisible();
  });

  test('required field validation prevents empty save', async ({ page }) => {
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToOverview();

    await page.locator('button[title="Edit Registration Profile"]').click();
    const modal = page.locator(MODAL);
    await modal.waitFor({ timeout: 5000 });

    // Open sponsor form but leave name empty
    const section = await clickAddInSection(page, 'sponsors');
    await fillInlineField(section, 'Tier', 'OFFICIAL');

    // Try to save — should not add item (name is required)
    await saveInlineForm(section);

    // The inline form should still be visible (not dismissed)
    await expect(section.locator('button:has-text("Cancel")').first()).toBeVisible();
  });

  test('fact sheet print modal shows template selector and action buttons', async ({ page }) => {
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToOverview();

    // Open fact sheet print modal
    await page.locator('button[title="Print Fact Sheet"]').click();
    const modal = page.locator(MODAL);
    await modal.waitFor({ timeout: 5000 });

    // Title
    await expect(modal.locator('text=Print Fact Sheet')).toBeVisible();

    // Template dropdown with 5 options
    const templateSelect = modal.locator('select').first();
    const options = await templateSelect.locator('option').allTextContents();
    expect(options).toHaveLength(5);

    // View and Download buttons exist
    await expect(modal.locator('button:has-text("View")')).toBeVisible();
    await expect(modal.locator('button:has-text("Download")')).toBeVisible();
    await expect(modal.locator('button:has-text("Cancel")')).toBeVisible();
  });
});
