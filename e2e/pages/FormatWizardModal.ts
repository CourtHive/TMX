import type { Page } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Page object for the Format Wizard modal.
 *
 * The modal is opened in tests via `dev.openFormatWizardModal(...)`
 * — the user-facing entry point (Tournament Actions menu) lands in
 * Phase 1.C.4. Tests can observe the form's live state via
 * `getFormState()` which mirrors what `getState()` on the form
 * handle returns.
 */
export class FormatWizardModal {
  constructor(private page: Page) {}

  async open(initialScaleName?: string): Promise<void> {
    await this.page.evaluate((scaleName) => {
      (globalThis as any).dev.openFormatWizardModal({ initialScaleName: scaleName });
    }, initialScaleName);
    await this.content.waitFor({ state: 'visible' });
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
