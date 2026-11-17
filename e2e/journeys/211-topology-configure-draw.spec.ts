import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { getTournamentRecord, seedTournament } from '../helpers/seed';
import { generateFromTopology } from '../helpers/topologyGenerate';
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Journey 211 — the topology builder's Generate opens the Configure draw drawer (CA 2026-11-17): the Add Draw
 * drawer's settings the topology does not define (score format, seeding policy, seeds, creation), and none of those
 * it does (name, type, size). What is chosen there is what the draw is made with.
 */
const PROFILE = {
  tournamentName: 'Topology Configure E2E',
  tournamentAttributes: { tournamentId: 'e2e-topology-configure-001' },
  participantsProfile: { participantsCount: 16 },
  eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 16 } }],
};

const field = (drawer: Locator, label: string) => drawer.locator(`.field:has(.label:text-is("${label}"))`);

async function openTopology(page: Page): Promise<Locator> {
  const tournamentId = await seedTournament(page, PROFILE);
  const record: any = await getTournamentRecord(page);
  await page.goto(`/#/tournament/${tournamentId}/topology/${record.events[0].eventId}`);
  const topology = page.locator('#tmxTopology');
  // the page opens with the Main its 16 accepted entries call for
  await expect(topology.locator('.tb-card')).toHaveCount(1, { timeout: 10_000 });
  return topology;
}

test.describe('Topology — Configure draw', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('offers what the topology does not define, and makes the draw with it', async ({ page }) => {
    const topology = await openTopology(page);
    await generateFromTopology(page, topology, async (drawer) => {
      for (const label of ['Score format', 'Seeding policy', 'Seed count', 'Creation']) {
        await expect(field(drawer, label)).toBeVisible();
      }
      for (const label of ['Draw name', 'Draw Type', 'Draw size']) {
        await expect(field(drawer, label)).toHaveCount(0);
      }
      await page.screenshot({ path: test.info().outputPath('configure-draw.png') });
      await field(drawer, 'Score format').locator('select').selectOption('SET1-S:6/TB7');
      await field(drawer, 'Creation').locator('select').selectOption({ label: 'Manual' });
    });

    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);
    const drawDefinition = ((await getTournamentRecord(page)) as any).events[0].drawDefinitions[0];
    expect(drawDefinition.matchUpFormat).toBe('SET1-S:6/TB7');
    // Manual: the draw is made with nobody placed
    const main = drawDefinition.structures.find((structure: any) => structure.stage === 'MAIN');
    expect(main.positionAssignments.filter((assignment: any) => assignment.participantId)).toHaveLength(0);
  });

  test('Cancel makes no draw', async ({ page }) => {
    const topology = await openTopology(page);
    await topology.getByRole('button', { name: 'Generate Draw', exact: true }).click();
    const drawer = page.locator('#tmxDrawer');
    await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('#tmxDrawer .drawer__wrapper')).toBeHidden();
    const record: any = await getTournamentRecord(page);
    expect(record.events[0].drawDefinitions ?? []).toHaveLength(0);
    // the canvas is as it was
    await expect(topology.locator('.tb-card')).toHaveCount(1);
  });
});
