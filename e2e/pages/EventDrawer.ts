import { Locator, Page } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Page object for the event editor drawer (`editEvent`), and the Match timing modal it launches in edit mode.
 *
 * The drawer renders inside #tmxDrawer through courthive-components' renderForm; fields are located by their
 * label text. The timing modal is a cModal, located by its dialog (`.chc-modal-dialog`): the outer section is a
 * fixed-position container that reads as hidden while the modal is on screen.
 */
export class EventDrawer {
  readonly drawer: Locator;
  readonly timingSummary: Locator;
  readonly timingModal: Locator;

  constructor(readonly page: Page) {
    this.drawer = page.locator(S.TMX_DRAWER);
    this.timingSummary = this.drawer.locator('.tmx-event-timing-summary-text');
    this.timingModal = page.locator('.chc-modal-dialog:has(.tmx-event-timing)');
  }

  /** Open the drawer for an event from its page's tab bar ("Edit event"), and wait for the form. */
  async openFromEventPage(): Promise<void> {
    await this.page.getByRole('button', { name: 'Edit event', exact: true }).click();
    await this.waitForOpen();
  }

  async waitForOpen(): Promise<void> {
    await this.page.locator(`${S.TMX_DRAWER} .drawer__wrapper`).waitFor({ state: 'visible', timeout: 15_000 });
    await this.fieldInput('Event name').waitFor({ state: 'visible', timeout: 5_000 });
  }

  async waitForClose(): Promise<void> {
    await this.page.locator(`${S.TMX_DRAWER} .drawer__wrapper`).waitFor({ state: 'hidden', timeout: 10_000 });
  }

  /** A text input in a labeled field. */
  fieldInput(labelText: string): Locator {
    return this.drawer.locator(`.field:has(.label:text-is("${labelText}")) input.input`);
  }

  /** A section heading the drawer draws ("General", "Dates & days", "Entries", "Match timing"). */
  heading(text: string): Locator {
    return this.drawer.getByText(text, { exact: true });
  }

  async close(): Promise<void> {
    await this.drawer.locator('button:has-text("Cancel")').click();
    await this.waitForClose();
  }

  /* ─── Match timing modal ───────────────────────────────────────────── */

  async openTiming(): Promise<void> {
    await this.drawer.locator('#eventTimingEdit').click();
    await this.timingModal.waitFor({ state: 'visible', timeout: 5_000 });
  }

  /** The row for one matchUpFormat. */
  timingRow(matchUpFormat: string): Locator {
    return this.timingModal.locator(`.tmx-event-timing-row[data-match-up-format="${matchUpFormat}"]`);
  }

  timingInput(matchUpFormat: string, field: 'averageMinutes' | 'recoveryMinutes'): Locator {
    return this.timingRow(matchUpFormat).locator(`input[data-field="${field}"]`);
  }

  /** "policy" or "event": whether the row's figures are the scheduling policy's or the event's own. */
  timingSource(matchUpFormat: string): Locator {
    return this.timingRow(matchUpFormat).locator('.tmx-event-timing-badge');
  }

  async setTiming(matchUpFormat: string, timing: { averageMinutes?: number; recoveryMinutes?: number }) {
    for (const field of ['averageMinutes', 'recoveryMinutes'] as const) {
      if (timing[field] !== undefined) await this.timingInput(matchUpFormat, field).fill(String(timing[field]));
    }
  }

  async saveTiming(): Promise<void> {
    await this.timingModal.locator('#eventTimingSave').click();
    await this.timingModal.waitFor({ state: 'hidden', timeout: 5_000 });
  }
}
