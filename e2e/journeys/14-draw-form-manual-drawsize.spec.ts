/**
 * Journey 14 — Draw form: Forced MANUAL when user reduces draw size
 *
 * When the user manually types a draw size smaller than entries +
 * qualifiers, the Automated creation option should be disabled and
 * the form should force MANUAL positioning.
 *
 * This is different from 8.2 (where increasing qualifiers auto-expands
 * drawSize). Here the user explicitly reduces drawSize below the
 * required threshold.
 *
 * @see Test matrix section 8.2
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

const PROFILE_16: MockProfile = {
  tournamentName: 'E2E Manual DrawSize',
  tournamentAttributes: { tournamentId: 'e2e-manual-ds' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

async function seedAndOpenDrawForm(page: any): Promise<DrawFormDrawer> {
  const tournamentId = await seedTournament(page, PROFILE_16);
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

test.describe('Journey 14 — Forced MANUAL on reduced draw size', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('reducing draw size below entry count forces MANUAL and disables Automated', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page);

    // Default: 16 entries, drawSize=16, Automated enabled
    const before = await page.evaluate(() => {
      const drawerEl = document.getElementById('tmxDrawer');
      const selects = drawerEl?.querySelectorAll('select') || [];
      for (const sel of selects) {
        for (const opt of sel.options) {
          if (opt.label === 'Automated') {
            return { automatedDisabled: opt.disabled, selectValue: sel.value };
          }
        }
      }
      return null;
    });
    expect(before?.automatedDisabled).toBe(false);

    // User manually sets drawSize to 8 (below 16 entries)
    // This triggers the drawSizeChange handler via the input event
    const after = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        const drawerEl = document.getElementById('tmxDrawer');
        const fields = drawerEl?.querySelectorAll('.field') || [];

        for (const field of fields) {
          const label = field.querySelector('.label');
          if (label?.textContent === 'Draw size') {
            const input = field.querySelector('input') as HTMLInputElement;
            if (!input) { resolve({ error: 'input not found' }); return; }

            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            setter?.call(input, '8');
            input.dispatchEvent(new Event('input', { bubbles: true }));

            // After synchronous handlers complete, check state
            requestAnimationFrame(() => {
              const selects = drawerEl?.querySelectorAll('select') || [];
              for (const sel of selects) {
                for (const opt of sel.options) {
                  if (opt.label === 'Automated') {
                    resolve({
                      drawSize: input.value,
                      automatedDisabled: opt.disabled,
                      selectValue: sel.value,
                    });
                    return;
                  }
                }
              }
              resolve({ drawSize: input.value, error: 'Automated option not found' });
            });
            return;
          }
        }
        resolve({ error: 'Draw size field not found' });
      });
    });

    console.log('14 — reduced drawSize result:', JSON.stringify(after));

    expect(after.drawSize).toBe('8');
    // With 16 entries and drawSize=8, manualOnly = 8 < 16 = true
    // The Automated option should be disabled
    expect(after.automatedDisabled).toBe(true);

    await drawer.clickCancel();
  });

  test('restoring draw size above entry count re-enables Automated', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page);

    // Reduce to 8, then restore to 16
    const result = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        const drawerEl = document.getElementById('tmxDrawer');
        const fields = drawerEl?.querySelectorAll('.field') || [];

        for (const field of fields) {
          const label = field.querySelector('.label');
          if (label?.textContent === 'Draw size') {
            const input = field.querySelector('input') as HTMLInputElement;
            if (!input) { resolve({ error: 'not found' }); return; }

            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

            // Step 1: reduce to 8
            setter?.call(input, '8');
            input.dispatchEvent(new Event('input', { bubbles: true }));

            // Step 2: restore to 16
            setter?.call(input, '16');
            input.dispatchEvent(new Event('input', { bubbles: true }));

            requestAnimationFrame(() => {
              const selects = drawerEl?.querySelectorAll('select') || [];
              for (const sel of selects) {
                for (const opt of sel.options) {
                  if (opt.label === 'Automated') {
                    resolve({
                      drawSize: input.value,
                      automatedDisabled: opt.disabled,
                    });
                    return;
                  }
                }
              }
              resolve({ drawSize: input.value, error: 'not found' });
            });
            return;
          }
        }
        resolve({ error: 'field not found' });
      });
    });

    console.log('14 — restored drawSize result:', JSON.stringify(result));

    expect(result.drawSize).toBe('16');
    // 16 >= 16 + 0 qualifiers → manualOnly = false → Automated re-enabled
    expect(result.automatedDisabled).toBe(false);

    await drawer.clickCancel();
  });

  test('generate button disabled when draw size is invalid', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page);

    // Set draw size to 1 (below minimum of 2)
    const result = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        const drawerEl = document.getElementById('tmxDrawer');
        const fields = drawerEl?.querySelectorAll('.field') || [];

        for (const field of fields) {
          const label = field.querySelector('.label');
          if (label?.textContent === 'Draw size') {
            const input = field.querySelector('input') as HTMLInputElement;
            if (!input) { resolve({ error: 'not found' }); return; }

            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            setter?.call(input, '1');
            input.dispatchEvent(new Event('input', { bubbles: true }));

            requestAnimationFrame(() => {
              const generateBtn = document.getElementById('generateDraw') as HTMLButtonElement;
              resolve({
                drawSize: input.value,
                generateDisabled: generateBtn?.disabled ?? null,
              });
            });
            return;
          }
        }
        resolve({ error: 'field not found' });
      });
    });

    console.log('14 — invalid drawSize result:', JSON.stringify(result));

    expect(result.drawSize).toBe('1');
    // Generate button should be disabled for invalid draw size
    expect(result.generateDisabled).toBe(true);

    await drawer.clickCancel();
  });
});
