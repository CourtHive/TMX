import { Locator, Page, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Page object for the draw configuration drawer (addDraw).
 *
 * The drawer is rendered inside #tmxDrawer by courthive-components' renderForm.
 * Fields are located by their label text within the drawer — the labels come
 * from i18n but are stable English strings in test environments.
 */
export class DrawFormDrawer {
  readonly drawer: Locator;
  readonly generateButton: Locator;
  readonly cancelButton: Locator;

  constructor(readonly page: Page) {
    this.drawer = page.locator(S.TMX_DRAWER);
    this.generateButton = this.drawer.locator('#generateDraw');
    this.cancelButton = this.drawer.getByRole('button', { name: 'Cancel' });
  }

  /* ─── Waiting ──────────────────────────────────────────────────────── */

  /** Wait for the drawer to be visible and the form to be rendered. */
  async waitForOpen(): Promise<void> {
    await this.drawer.waitFor({ state: 'visible', timeout: 10_000 });
    // The form is rendered — wait for at least the drawType select to appear
    await this.fieldSelect('Draw type').waitFor({ state: 'visible', timeout: 5_000 });
  }

  /** Wait for the drawer to close. */
  async waitForClose(): Promise<void> {
    await this.drawer.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  /* ─── Field locators ───────────────────────────────────────────────── */

  /** Locate a .field container by its label text. */
  private fieldContainer(labelText: string): Locator {
    return this.drawer.locator(`.field:has(.label:text-is("${labelText}"))`);
  }

  /** Locate a <select> within a labeled field. */
  fieldSelect(labelText: string): Locator {
    return this.fieldContainer(labelText).locator('select');
  }

  /** Locate a text <input> within a labeled field. */
  fieldInput(labelText: string): Locator {
    return this.fieldContainer(labelText).locator('input.input');
  }

  /** Locate a checkbox <input> by its DOM id. Checkboxes in renderForm
   *  get `id` from item.id — use the tmxConstants value directly. */
  checkbox(id: string): Locator {
    return this.drawer.locator(`#${id}`);
  }

  /* ─── Visibility assertions ────────────────────────────────────────── */

  /** Assert a labeled field is visible. */
  async expectFieldVisible(labelText: string): Promise<void> {
    await expect(this.fieldContainer(labelText)).toBeVisible();
  }

  /** Assert a labeled field is hidden (display:none on the .field div). */
  async expectFieldHidden(labelText: string): Promise<void> {
    await expect(this.fieldContainer(labelText)).toBeHidden();
  }

  /** Assert a checkbox is visible by its DOM id. */
  async expectCheckboxVisible(id: string): Promise<void> {
    await expect(this.checkbox(id).locator('..')).toBeVisible();
  }

  /** Assert a checkbox is hidden by its DOM id. */
  async expectCheckboxHidden(id: string): Promise<void> {
    await expect(this.checkbox(id).locator('..')).toBeHidden();
  }

  /* ─── Value getters ────────────────────────────────────────────────── */

  async getSelectValue(labelText: string): Promise<string> {
    return this.fieldSelect(labelText).inputValue();
  }

  async getInputValue(labelText: string): Promise<string> {
    return this.fieldInput(labelText).inputValue();
  }

  /* ─── Actions ──────────────────────────────────────────────────────── */

  /** Select a draw type by its value (e.g. 'ROUND_ROBIN'). */
  async selectDrawType(value: string): Promise<void> {
    await this.fieldSelect('Draw type').selectOption(value);
  }

  /** Set a numeric input value (clears first). */
  async setInputValue(labelText: string, value: string): Promise<void> {
    const input = this.fieldInput(labelText);
    await input.fill(value);
  }

  /** Toggle a checkbox. */
  async toggleCheckbox(id: string): Promise<void> {
    await this.checkbox(id).check();
  }

  /** Click the Generate button. */
  async clickGenerate(): Promise<void> {
    await this.generateButton.click();
  }

  /** Click Cancel to close the drawer. */
  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForClose();
  }
}
