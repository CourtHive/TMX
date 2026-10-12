import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/dev-bridge';
import { routeApiToCfs } from '../helpers/cfsProxy';
import {
  SERVER,
  ensureProvider,
  deleteProvider,
  uniqueSuffix,
  uniqueAbbr,
  signInSuperAdmin,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
} from '../helpers/role-fixtures';

/**
 * Journey 155 — a type-ahead's suggestions are not cut off by the modal they open in.
 *
 * Reported 2026-10-11 on "Select provider": the modal body scrolls (`overflow-y: auto`) and Awesomplete draws
 * its list below the input, so the list ran under the footer and the lower suggestions could not be seen or
 * clicked without scrolling the body. `openModal` now grows the content while a list is open
 * (`keepTypeAheadInView`), for every TMX modal with a type-ahead.
 *
 * Visibility is judged by what is actually drawn at each suggestion's centre (`elementFromPoint`), not by
 * Playwright's `toBeVisible`, which counts a clipped element as visible; a click would also pass, because it
 * scrolls the body first, which is why journey 58 never saw this. Requires CFS at SERVER.
 */

const suffix = uniqueSuffix();
const PREFIX = `E2E Clip ${suffix}`;
const PROVIDERS = ['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => ({
  abbr: uniqueAbbr(letter),
  name: `${PREFIX} ${letter}`,
}));
const ids: (string | undefined)[] = [];
let token: string | null = null;
let seeded = false;

async function loginAsSuperAdmin(page: Page): Promise<void> {
  await routeApiToCfs(page);
  await page.goto('/');
  await waitForAppReady(page);
  await page.locator('#login').click();
  await page.getByText('Log in').click();
  await page.locator('input[placeholder*="email"]').fill(SUPERADMIN_EMAIL);
  await page.locator('input[placeholder*="8 characters"]').fill(SUPERADMIN_PASSWORD);
  await page.locator('#loginButton').click();
  await page.waitForTimeout(1500);
}

/** Each suggestion's centre, and whether that point actually shows the suggestion rather than what covers it. */
function suggestionsOnTop(page: Page): Promise<boolean[]> {
  return page.locator('ul[role="listbox"]:not([hidden]) li').evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return !!top && item.contains(top);
    }),
  );
}

test.describe('Journey 155 — type-ahead suggestions inside a modal', () => {
  test.beforeAll(async ({ request }) => {
    token = await signInSuperAdmin(request);
    if (!token) return;
    for (const { abbr, name } of PROVIDERS) ids.push(await ensureProvider(request, token, abbr, name));
    seeded = ids.every(Boolean);
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    for (const [index, { abbr }] of PROVIDERS.entries()) await deleteProvider(request, token, ids[index], abbr);
  });

  test('every suggestion in "Select provider" is drawn on top, not under the footer', async ({ page }) => {
    test.skip(!seeded, `seed unavailable (CFS at ${SERVER} / bootstrap super-admin)`);
    await loginAsSuperAdmin(page);
    await page.locator('#provider').click();
    await page.getByText(/(Select|Switch) provider/).click();

    const body = page.locator('.chc-modal-body');
    const paddingBottom = () => body.evaluate((element) => (element as HTMLElement).style.paddingBottom);
    const before = await paddingBottom();

    const input = page.locator('input[placeholder="Type provider name"]');
    await input.click();
    await input.fill(PREFIX);
    const items = page.locator('ul[role="listbox"]:not([hidden]) li');
    await expect(items).toHaveCount(PROVIDERS.length);

    // Awesomplete scales the list in from zero; judge it once every row has its full height
    const heights = () =>
      items.evaluateAll((rows) => rows.map((row) => Math.round(row.getBoundingClientRect().height)));
    await expect.poll(async () => (await heights()).every((height) => height > 10), { timeout: 5_000 }).toBe(true);
    await page.waitForTimeout(400);
    expect(await suggestionsOnTop(page)).toEqual(PROVIDERS.map(() => true));

    // the room is given back when the list closes
    await input.press('Escape');
    await expect(page.locator('ul[role="listbox"]')).toBeHidden();
    expect(await paddingBottom()).toBe(before);
  });
});
