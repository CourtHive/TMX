import { expect, type Page } from '@playwright/test';

/**
 * Set a time on TMX's shared time picker (`components/modals/timePicker`, timepicker-ui's 12-hour dial) and confirm
 * it. `time` is 24-hour `HH:MM`; the minutes must sit on the dial's five-minute tips.
 *
 * The dial resolves a value from the pointer's position on a face that animates between hours and minutes, so a tip
 * is clicked with `force`, and again until the field shows it: a click landed during the face swap is dropped
 * (journey 110 found this first).
 */
export async function pickTime(page: Page, time: string): Promise<void> {
  const [hours, minutes] = time.split(':').map(Number);
  if (minutes % 5) throw new Error(`pickTime: ${time} is not on a five-minute tip`);
  await expect(page.locator('.tp-ui-modal')).toBeVisible();
  // the selected half of the day takes no pointer events, so only the other one is clicked
  const meridiem = page.locator(hours >= 12 ? '.tp-ui-pm' : '.tp-ui-am');
  if (!(await meridiem.getAttribute('class'))?.split(' ').includes('active')) await meridiem.click();
  await dial(page, 'input.tp-ui-hour', 'span.tp-ui-hour-time-12', hours % 12 || 12);
  await dial(page, 'input.tp-ui-minutes', 'span.tp-ui-minutes-time', minutes);
  await page.locator('.tp-ui-ok-btn').click();
}

async function dial(page: Page, fieldSelector: string, tipSelector: string, value: number): Promise<void> {
  const field = page.locator(fieldSelector);
  if (Number(await field.inputValue()) === value) return;
  await field.click();
  const label = tipSelector.includes('minutes') ? String(value).padStart(2, '0') : String(value);
  const tip = page.locator(`.tp-ui-tips-wrapper ${tipSelector}`, { hasText: new RegExp(`^${label}$`) }).first();
  await expect(tip).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.waitForTimeout(400);
    await tip.click({ force: true });
    if (Number(await field.inputValue()) === value) return;
  }
  expect(Number(await field.inputValue())).toBe(value);
}
