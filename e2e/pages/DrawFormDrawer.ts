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
    // Cancel button rendered by courthive-components renderButtons —
    // it's a <button> inside the drawer footer. Use text matching
    // since it has no ID.
    this.cancelButton = this.drawer.locator('button:has-text("Cancel")');
  }

  /* ─── Waiting ──────────────────────────────────────────────────────── */

  /** Wait for the drawer to be visible and the form to be rendered.
   *  The #tmxDrawer section is a wrapper — the actual visible content
   *  lives inside .drawer__wrapper which slides in via CSS transform.
   *  We wait for the wrapper to become visible (transform complete),
   *  then for the drawType select to confirm the form is rendered. */
  async waitForOpen(): Promise<void> {
    await this.page.locator(`${S.TMX_DRAWER} .drawer__wrapper`).waitFor({ state: 'visible', timeout: 15_000 });
    await this.fieldSelect('Draw Type').waitFor({ state: 'visible', timeout: 5_000 });
  }

  /** Wait for the drawer to close. The drawer section itself may remain
   *  in the DOM with display:none — wait for the wrapper to not be visible. */
  async waitForClose(): Promise<void> {
    await this.page.locator(`${S.TMX_DRAWER} .drawer__wrapper`).waitFor({ state: 'hidden', timeout: 10_000 });
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
    await this.fieldSelect('Draw Type').selectOption(value);
  }

  /** Set a numeric input value (clears first). */
  async setInputValue(labelText: string, value: string): Promise<void> {
    const input = this.fieldInput(labelText);
    await input.fill(value);
  }

  /** Toggle a checkbox. The actual `<input>` is visually hidden via the
   *  `is-checkradio` CSS pattern. We programmatically click the input
   *  via evaluate since the label/input may be in the drawer's scroll
   *  area and Playwright's scroll-into-view can mis-target the scroll
   *  container.
   *
   *  For qualifyingFirst, the change handler (qualifyingFirstChange)
   *  re-renders draw type options, toggles field visibility, and
   *  re-derives draw size. We wait for the draw type select's options
   *  to change as a signal that the handler completed. */
  async toggleCheckbox(id: string): Promise<void> {
    // Capture the draw type option count before toggle
    const optionCountBefore = await this.fieldSelect('Draw Type')
      .locator('option')
      .count()
      .catch(() => 0);

    // Click the checkbox and wait for the change event handler to
    // complete its DOM mutations. We use a Promise that resolves
    // when the handler finishes by watching for a known DOM change.
    await this.page.evaluate((checkboxId) => {
      return new Promise<void>((resolve) => {
        const input = document.getElementById(checkboxId) as HTMLInputElement;
        if (!input) { resolve(); return; }

        // Listen for the NEXT change event on the input — when the
        // handler is done, the DOM has been mutated.
        const handler = () => {
          input.removeEventListener('change', handler);
          // Use requestAnimationFrame to let any synchronous DOM
          // mutations from the handler flush before resolving
          requestAnimationFrame(() => resolve());
        };
        input.addEventListener('change', handler);
        input.click();
      });
    }, id);
  }

  /** Click the Generate button. It lives in the drawer footer which
   *  is often below the fold. Use evaluate to bypass viewport checks. */
  async clickGenerate(): Promise<void> {
    await this.page.evaluate(() => {
      const btn = document.getElementById('generateDraw') as HTMLButtonElement;
      if (btn) btn.click();
    });
  }

  /** Close the drawer. Tries the overlay backdrop first; falls back
   *  to clicking outside the drawer wrapper if the overlay isn't
   *  rendered (e.g. ATTACH_QUALIFYING mode where the drawer opens
   *  without an overlay). */
  async clickCancel(): Promise<void> {
    const overlay = this.page.locator(`${S.TMX_DRAWER} .drawer__overlay`);
    if (await overlay.isVisible().catch(() => false)) {
      await overlay.click({ force: true });
    } else {
      // Fallback: click at (0,0) — outside the drawer wrapper
      await this.page.mouse.click(0, 0);
    }
    await this.waitForClose();
  }
}
