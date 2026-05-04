import type { Page } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Page object for the Format Wizard.
 *
 * As of Phase 2.D the wizard is a tournament-context page (route
 * `/tournament/:tournamentId/format-wizard`), not a modal. Open it
 * via the launcher button on the overview, the admin actions panel
 * button, or the dev backdoor.
 *
 * The class name `FormatWizardModal` is preserved for binary
 * compatibility with existing journeys; rename in a follow-up.
 */
export class FormatWizardModal {
  constructor(private page: Page) {}

  /**
   * Open the wizard via the Tournament Actions menu — the canonical
   * user flow. Requires the test to have navigated to a tournament
   * whose visibility conditions are met (no events OR participants
   * with no event entries) and the active role is admin / super-admin.
   */
  async openViaActionsMenu(): Promise<void> {
    await this.actionButton.click();
    await this.content.waitFor({ state: 'visible' });
  }

  /**
   * Open the wizard via the always-visible launcher button on the
   * overview page (NOT admin-gated — the demo-mode entry point).
   */
  async openViaLauncher(): Promise<void> {
    await this.launchButton.click();
    await this.content.waitFor({ state: 'visible' });
  }

  /**
   * Open the wizard via the dev-bridge backdoor. Useful when a test
   * cares about page behaviour but not about the entry-point flow,
   * or when the seed deliberately violates the visibility
   * conditions (e.g., for hidden-button assertions).
   */
  async openViaDevBridge(): Promise<void> {
    await this.page.evaluate(() => {
      (globalThis as any).dev.openFormatWizard();
    });
    await this.content.waitFor({ state: 'visible' });
  }

  /** @deprecated Prefer openViaActionsMenu / openViaLauncher / openViaDevBridge — kept for drop-in compatibility. */
  async open(): Promise<void> {
    return this.openViaDevBridge();
  }

  get actionButton() {
    return this.page.locator(S.FORMAT_WIZARD_ACTION_BUTTON);
  }

  get launchButton() {
    return this.page.locator(S.FORMAT_WIZARD_LAUNCHER);
  }

  get backButton() {
    return this.page.locator(S.FORMAT_WIZARD_BACK);
  }

  get content() {
    return this.page.locator(S.FORMAT_WIZARD_CONTENT);
  }

  get form() {
    return this.page.locator(S.FORMAT_WIZARD_FORM);
  }

  get rightPane() {
    return this.page.locator(S.FORMAT_WIZARD_RIGHT_PANE);
  }

  get scaleSelect() {
    return this.page.locator(S.FORMAT_WIZARD_SCALE);
  }

  get courtsInput() {
    return this.page.locator(S.FORMAT_WIZARD_COURTS);
  }

  get daysInput() {
    return this.page.locator(S.FORMAT_WIZARD_DAYS);
  }

  get hoursPerDayInput() {
    return this.page.locator(S.FORMAT_WIZARD_HOURS_PER_DAY);
  }

  get minFloorInput() {
    return this.page.locator(S.FORMAT_WIZARD_MIN_FLOOR);
  }

  get targetCtInput() {
    return this.page.locator(S.FORMAT_WIZARD_TARGET_CT);
  }

  get appetiteSelect() {
    return this.page.locator(S.FORMAT_WIZARD_APPETITE);
  }

  get distribution() {
    return this.page.locator(S.FORMAT_WIZARD_DISTRIBUTION);
  }

  get planList() {
    return this.page.locator(S.FORMAT_WIZARD_PLAN_LIST);
  }

  get emptyState() {
    return this.page.locator(S.FORMAT_WIZARD_EMPTY);
  }

  get planCards() {
    return this.page.locator('.tmx-format-wizard-plan-card');
  }

  planCardByRank(rank: number) {
    return this.page.locator(`.tmx-format-wizard-plan-card[data-rank="${rank}"]`);
  }

  async planCount(): Promise<number> {
    return this.planCards.count();
  }

  applyButtonByRank(rank: number) {
    return this.page.locator(`.tmx-format-wizard-apply-btn[data-rank="${rank}"]`);
  }

  get resetLink() {
    return this.page.locator(S.FORMAT_WIZARD_RESET_LINK);
  }

  get capacityCue() {
    return this.page.locator(S.FORMAT_WIZARD_CAPACITY_CUE);
  }

  async close(): Promise<void> {
    await this.backButton.evaluate((b: HTMLButtonElement) => b.click());
    // The page container hides (display:none) on back-nav; the inner
    // content stays in the DOM until the next renderFormatWizardPage
    // call. Wait for hidden, not detached.
    await this.content.waitFor({ state: 'hidden', timeout: 5_000 });
  }

  async clickReset(): Promise<void> {
    await this.resetLink.evaluate((b: HTMLButtonElement) => b.click());
  }

  async setCourts(value: number): Promise<void> {
    await this.courtsInput.fill(String(value));
  }

  async setDays(value: number): Promise<void> {
    await this.daysInput.fill(String(value));
  }

  async setTargetCompetitivePct(percent: number): Promise<void> {
    await this.targetCtInput.fill(String(percent));
  }

  async selectScale(scaleName: string): Promise<void> {
    await this.scaleSelect.selectOption(scaleName);
  }

  async selectAppetite(appetite: 'NONE' | 'LIGHT' | 'FULL'): Promise<void> {
    await this.appetiteSelect.selectOption(appetite);
  }
}
