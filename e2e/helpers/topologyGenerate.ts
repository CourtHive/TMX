import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** The topology's Generate opens the Configure draw drawer; its own Generate makes the draw. */
export async function generateFromTopology(
  page: Page,
  topology: Locator,
  configure?: (drawer: Locator) => Promise<void>,
): Promise<void> {
  await topology.getByRole('button', { name: 'Generate Draw', exact: true }).click();
  const generate = page.locator('#generateTopologyDraw');
  await expect(generate).toBeVisible();
  // the drawer slides in: settle it on screen before it is read or pictured
  const width = page.viewportSize()?.width ?? 0;
  await expect.poll(async () => ((await generate.boundingBox()) ?? { x: width, width: 1 }).x + 1 <= width).toBe(true);
  await expect.poll(async () => (await generate.boundingBox())?.x).toBe((await generate.boundingBox())?.x);
  if (configure) await configure(page.locator('#tmxDrawer'));
  await generate.click();
}
