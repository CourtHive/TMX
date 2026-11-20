import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { daysFromTodayLocal } from '../helpers/dates';
import { S } from '../helpers/selectors';

/**
 * Journey 219 — one chip rule everywhere, legible in every theme (CA 2026-11-20).
 *
 * The rule: a filter chip is outlined at rest and filled, and `aria-pressed`, only while it narrows the list. Before
 * it, every chip was filled while no filter was set ("every value included"), which read as every filter being on and
 * announced every chip as pressed.
 *
 * The contrast half is measured, not assumed. Theme tokens existing for both themes did not make the chips legible:
 * the dark theme's filled chip read 3.3:1 (dark "inverse" text on the accent fill), and the outlined chip's border was
 * 1.3:1 on the Linen and Slate palettes. So for each theme and palette this journey reads the COMPUTED colours of
 * real chips, at rest and filtering, on the participants footer (accent chips) and the matchUps footer (status-colour
 * chips), and holds them to WCAG AA: 4.5:1 for a chip's text, 3:1 for the edge that tells a chip apart from the
 * surface it sits on (an outlined chip's border, a filled chip's fill).
 */

/** Every palette TMX offers, light and dark, by its own id. */
const THEMES: [string, string][] = [
  ['light', 'courtside'],
  ['light', 'linen'],
  ['light', 'slate'],
  ['dark', 'midnight'],
  ['dark', 'graphite'],
];

type Finding = { chip: string; state: string; what: string; ratio: number; min: number };

/** Every visible chip under `container`, measured; returns the ones below the bar. */
async function measure(page: Page, container: string): Promise<Finding[]> {
  const { findings, measured } = await page.evaluate((selector) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
    const opaque = (el: Element | null): number[] => {
      for (let n = el; n; n = n.parentElement) {
        const [r, g, b, a = 1] = parse(getComputedStyle(n).backgroundColor);
        if (a > 0.5) return [r, g, b];
      }
      return [255, 255, 255];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const findings: Finding[] = [];
    const chips = [...document.querySelectorAll(`${selector} .filter-popover-chip`)] as HTMLElement[];
    // both states of every chip, whichever it is in now: a chip is legible outlined AND filled, in every theme
    for (const chip of chips) {
      if (!chip.offsetParent) continue;
      const was = chip.dataset.on;
      // chips animate their colours: read the settled state, not the first frame of a transition
      chip.style.transition = 'none';
      for (const on of [false, true]) {
        chip.dataset.on = String(on);
        const surface = opaque(chip.parentElement);
        const label = chip.firstElementChild as HTMLElement;
        const count = chip.querySelector('.tmx-status-strip-count') as HTMLElement | null;
        const check = (what: string, value: number, min: number) => {
          if (value < min) {
            const name = (label?.textContent ?? chip.textContent ?? '?').trim();
            findings.push({ chip: name, state: on ? 'filled' : 'outlined', what, ratio: +value.toFixed(2), min });
          }
        };
        check('label', ratio(parse(getComputedStyle(label ?? chip).color), opaque(chip)), 4.5);
        if (count) check('count', ratio(parse(getComputedStyle(count).color), opaque(count)), 4.5);
        // a filled chip's edge is its fill, or its border where the fill alone sits too close to the surface
        if (on) {
          const edge = Math.max(
            ratio(opaque(chip), surface),
            ratio(parse(getComputedStyle(chip).borderTopColor), surface),
          );
          check('edge vs surface', edge, 3);
        } else check('border vs surface', ratio(parse(getComputedStyle(chip).borderTopColor), surface), 3);
      }
      chip.dataset.on = was;
      chip.style.transition = '';
    }
    return { findings, measured: chips.filter((chip) => chip.offsetParent).length };
  }, container);
  // a measurement that found no chips would pass vacuously: it must have looked at something
  expect(measured, `chips measured in ${container}`).toBeGreaterThan(0);
  return findings;
}

/**
 * Switch theme the way the settings UI does: choose the palette for the mode, then apply the mode. Setting
 * `data-theme` alone is not a theme switch: applyTheme also sets the palette and the body's `tmx-dark` class, and a
 * half-switched page measures colours no user ever sees.
 */
async function setTheme(page: Page, theme: string, palette: string) {
  await page.evaluate(
    async ({ mode, paletteId, module }) => {
      const { setPalettePreference, applyTheme } = await import(module);
      // surfaces and chips animate their colours on a theme change: measure the settled theme, not a frame of the fade
      if (!document.getElementById('e2e-no-transitions')) {
        const style = document.createElement('style');
        style.id = 'e2e-no-transitions';
        style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
        document.head.appendChild(style);
      }
      setPalettePreference(mode, paletteId);
      applyTheme(mode);
    },
    { mode: theme, paletteId: palette, module: '/src/services/theme/themeService.ts' },
  );
  await page.waitForTimeout(100);
}

async function seed(page: Page): Promise<string> {
  const dates = { startDate: daysFromTodayLocal(-1), endDate: daysFromTodayLocal(3) };
  return page.evaluate(async ({ startDate, endDate }) => {
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      tournamentName: 'E2E Chip Contrast',
      tournamentAttributes: { tournamentId: 'e2e-chip-contrast', startDate, endDate },
      participantsProfile: { participantsCount: 6 },
      drawProfiles: [{ eventName: 'U14', category: { ageCategoryCode: 'U14' }, drawSize: 16, completionGoal: 6 }],
    });
    await dev.load(tournamentRecord);
    return tournamentRecord.tournamentId;
  }, dates);
}

/** Every chip in `container` outlined and not pressed: the rest state. */
async function expectAtRest(page: Page, container: string) {
  const states = await page
    .locator(`${container} .filter-popover-chip`)
    .evaluateAll((els) => els.map((el) => `${(el as HTMLElement).dataset.on}/${el.getAttribute('aria-pressed')}`));
  expect(states.length).toBeGreaterThan(0);
  expect(new Set(states), `chip states: ${JSON.stringify(states)}`).toEqual(new Set(['false/false']));
}

test.describe('Journey 219 — filter chip rule and contrast in every theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('participants footer: outlined at rest, filled only while narrowing, legible everywhere', async ({ page }) => {
    const tournamentId = await seed(page);
    await page.goto(`/#/tournament/${tournamentId}/participants`);
    await page.locator(`${S.TOURNAMENT_PARTICIPANTS} .tabulator-row`).first().waitFor();
    const footer = '.tmx-participants-footer';

    await expectAtRest(page, footer);
    await page.locator(`${footer} [data-value="unentered"]`).click();
    await expect(page.locator(`${footer} [data-value="unentered"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${footer} [data-value="entered"]`)).toHaveAttribute('aria-pressed', 'false');

    for (const [theme, palette] of THEMES) {
      await setTheme(page, theme, palette);
      expect(await measure(page, footer), `${theme}/${palette} filtering`).toEqual([]);
    }
    // turning the last chip off clears the filter: back to rest
    await page.locator(`${footer} [data-value="unentered"]`).click();
    // the footer repaints on the next frame
    await expect(page.locator(`${footer} [data-value="unentered"]`)).toHaveAttribute('aria-pressed', 'false');
    await expectAtRest(page, footer);
    for (const [theme, palette] of THEMES) {
      await setTheme(page, theme, palette);
      expect(await measure(page, footer), `${theme}/${palette} at rest`).toEqual([]);
    }
  });

  test('matchUps footer: status-colour chips follow the same rule, legible everywhere', async ({ page }) => {
    const tournamentId = await seed(page);
    await page.goto(`/#/tournament/${tournamentId}/matchUps`);
    await page.locator('#tournamentMatchUps .tabulator-row').first().waitFor();
    const strip = '.tmx-status-strip';

    await expectAtRest(page, strip);
    for (const [theme, palette] of THEMES) {
      await setTheme(page, theme, palette);
      expect(await measure(page, strip), `${theme}/${palette} at rest`).toEqual([]);
    }
    // the filter popover: the same chips, plus the ones only it shows (competitiveness profile, type, draw)
    await page.locator('button:has(.fa-filter)').first().click();
    await page.locator('.tippy-box .filter-popover-chip').first().waitFor();
    for (const [theme, palette] of THEMES) {
      await setTheme(page, theme, palette);
      expect(await measure(page, '.tippy-box'), `${theme}/${palette} popover`).toEqual([]);
    }
    await page.keyboard.press('Escape');

    const first = page.locator(`${strip} .filter-popover-chip`).first();
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    for (const [theme, palette] of THEMES) {
      await setTheme(page, theme, palette);
      expect(await measure(page, strip), `${theme}/${palette} filtering`).toEqual([]);
    }
  });
});
