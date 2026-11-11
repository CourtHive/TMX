import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { getTournamentRecord, seedTournament } from '../helpers/seed';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const MAIN = 'MAIN';
const QUALIFYING = 'QUALIFYING';
const DA = 'DIRECT_ACCEPTANCE';
const ALT = 'ALTERNATE';
async function setup(
  page: Page,
  {
    qualifying = 0,
    sanctioned = false,
    permission = false,
    alternateLimit = undefined as number | undefined,
    mainAlternates = 0,
    qualifyingAlternates = 0,
  } = {},
) {
  const tournamentId = await seedTournament(page, {
    tournamentName: 'Qualifying Fit E2E',
    tournamentAttributes: { tournamentId: 'e2e-topology-qualify' },
    participantsProfile: { participantsCount: 40 + qualifying + mainAlternates + qualifyingAlternates },
    eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 40 } }],
  });
  const eventId = await page.evaluate(
    async ({ qualifying, sanctioned, permission, alternateLimit, mainAlternates, qualifyingAlternates }) => {
      const record: any = dev.getTournament();
      const event = record.events[0];
      if (qualifying) {
        const entered = new Set(event.entries.map((entry: any) => entry.participantId));
        const ids = record.participants
          .filter((p: any) => !entered.has(p.participantId))
          .slice(0, qualifying)
          .map((p: any) => p.participantId);
        const result = dev.factory.tournamentEngine.addEventEntries({
          eventId: event.eventId,
          participantIds: ids,
          entryStage: 'QUALIFYING',
        });
        if (!result.success) throw new Error(JSON.stringify(result));
      }
      for (const [count, entryStage] of [
        [mainAlternates, 'MAIN'],
        [qualifyingAlternates, 'QUALIFYING'],
      ] as const) {
        if (!count) continue;
        const current: any = dev.getTournament();
        const entered = new Set(current.events[0].entries.map((entry: any) => entry.participantId));
        const ids = current.participants
          .filter((participant: any) => !entered.has(participant.participantId))
          .slice(0, count)
          .map((participant: any) => participant.participantId);
        const result = dev.factory.tournamentEngine.addEventEntries({
          eventId: event.eventId,
          participantIds: ids,
          entryStage,
          entryStatus: 'ALTERNATE',
        });
        if (!result.success) throw new Error(JSON.stringify(result));
      }
      const updated: any = dev.getTournament();
      if (sanctioned)
        updated.sanction = {
          sanctioningId: 'qualify-sanction',
          constraints: {
            definedBy: { providerId: 'governing-body' },
            events: [
              {
                match: { eventType: 'SINGLES' },
                drawSize: 32,
                ...(alternateLimit !== undefined && { maxAlternates: alternateLimit }),
                ...(permission && { overrideLimits: { drawSize: 64 } }),
              },
            ],
          },
        };
      await dev.load(updated);
      dev.context({ internal: true });
      return event.eventId;
    },
    { qualifying, sanctioned, permission, alternateLimit, mainAlternates, qualifyingAlternates },
  );
  await page.goto(`/#/tournament/${tournamentId}/topology/${eventId}`);
  const topology = page.locator('#tmxTopology');
  await expect(topology.locator('button.tb-mode-toggle[data-mode="fit"]')).toHaveAttribute('aria-pressed', 'true');
  await topology.getByRole('button', { name: 'Add Structure', exact: true }).click();
  await page
    .locator('.dropdown-item', { hasText: /^Main$/ })
    .first()
    .click();
  await expect(topology.locator('.tb-fit-status')).toHaveAttribute('data-status', 'OVER');
  return topology;
}

test.describe('Topology — qualifying acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('Qualify previews and Generate moves the ranked tail before attaching both brackets', async ({ page }) => {
    const topology = await setup(page);
    const before: any = await getTournamentRecord(page);
    const collector = createMutationCollector(page);
    await topology.locator('.tb-proposals-toggle').click();
    await expect(topology.locator('[data-kind="Qualify"]')).toContainText('16 to qualifying');
    await topology.locator('[data-kind="Qualify"]').first().click();
    await expect(topology.locator('.tb-card')).toHaveCount(2);
    const mainCard = topology
      .locator('.tb-card')
      .filter({ has: page.locator('.tb-card-name', { hasText: /^Main Draw$/ }) });
    const qualifyingCard = topology
      .locator('.tb-card')
      .filter({ has: page.locator('.tb-card-name', { hasText: /^Qualifying$/ }) });
    const mainBox = await mainCard.boundingBox();
    const qualifyingBox = await qualifyingCard.boundingBox();
    expect(mainBox!.x).toBeGreaterThan(qualifyingBox!.x + qualifyingBox!.width);
    await topology.getByRole('button', { name: 'Qualifying line', exact: true }).click();
    await expect(topology.locator('.tb-acceptance[data-stage="QUALIFYING"] .tb-acceptance-row')).toHaveCount(16);
    const preview: any = await getTournamentRecord(page);
    expect(preview).toEqual(before);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(async (theme) => {
        const path = '/src/services/theme/themeService.ts';
        (await import(path)).applyTheme(theme);
      }, theme);
      await page.screenshot({ path: test.info().outputPath(`qualifying-${theme}.png`) });
    }
    await topology.getByRole('button', { name: 'Generate Draw', exact: true }).click();
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0)
      .toBe(1);
    const after: any = await getTournamentRecord(page);
    expect(after.events[0].entries.filter((entry: any) => (entry.entryStage ?? MAIN) === MAIN)).toHaveLength(24);
    expect(
      after.events[0].entries.filter((entry: any) => entry.entryStage === QUALIFYING && entry.entryStatus === DA),
    ).toHaveLength(16);
    expect(after.events[0].drawDefinitions[0].structures.map((structure: any) => structure.stage).sort()).toEqual([
      MAIN,
      QUALIFYING,
    ]);
    await expect
      .poll(() =>
        collector
          .getMutations()
          .some((mutation) => mutation.methods.some((method) => method.method === 'addDrawDefinition')),
      )
      .toBe(true);
    const queue = collector
      .getMutations()
      .find((mutation) => mutation.methods.some((method) => method.method === 'addDrawDefinition'))!;
    expect(queue.methods[0]).toMatchObject({
      method: 'modifyEntriesStatus',
      params: { stage: MAIN, entryStage: QUALIFYING, entryStatus: DA },
    });
    expect(queue.methods[0].params.participantIds).toHaveLength(16);
    expect(queue.methods[1].method).toBe('addDrawDefinition');
    collector.detach();
  });

  test('a qualifying demotion preserves its source while MAIN entrants move into qualifying', async ({ page }) => {
    const topology = await setup(page, { qualifying: 8 });
    const before: any = await getTournamentRecord(page);
    const given = before.events[0].entries
      .filter((entry: any) => entry.entryStage === QUALIFYING)
      .map((entry: any) => entry.participantId);
    expect(given).toHaveLength(8);
    await topology.locator('.tb-proposals-toggle').click();
    await topology.locator('[data-kind="Qualify"]').first().click();
    await topology.getByRole('button', { name: 'Qualifying line', exact: true }).click();
    const slider = topology.locator('.tb-acceptance[data-stage="QUALIFYING"] [role="slider"]');
    await slider.focus();
    await slider.press('ArrowUp');
    await expect(slider).toHaveAttribute('aria-valuenow', '31');
    await topology.getByRole('button', { name: 'Generate Draw', exact: true }).click();
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0)
      .toBe(1);
    const after: any = await getTournamentRecord(page);
    expect(after.events[0].entries.filter((entry: any) => entry.entryStage === QUALIFYING)).toHaveLength(32);
    expect(
      after.events[0].entries
        .filter((entry: any) => given.includes(entry.participantId))
        .every((entry: any) => entry.entryStage === QUALIFYING),
    ).toBe(true);
    expect(
      after.events[0].entries.filter((entry: any) => entry.entryStage === QUALIFYING && entry.entryStatus === ALT),
    ).toHaveLength(1);
    expect(after.events[0].entries.filter((entry: any) => (entry.entryStage ?? MAIN) === MAIN)).toHaveLength(16);
  });

  test('a record-permitted override survives the Generate queue while the base sanction remains unchanged', async ({
    page,
  }) => {
    const topology = await setup(page, { sanctioned: true, permission: true });
    await topology.getByRole('button', { name: 'Sanction limits', exact: true }).click();
    const input = topology.getByRole('spinbutton', { name: 'Main draw size', exact: true });
    await expect(input).toHaveAttribute('max', '64');
    await input.fill('64');
    await input.press('Tab');
    await topology.locator('.tb-proposals-toggle').click();
    await topology.locator('[data-kind="Grow"]').click();
    await topology.getByRole('button', { name: 'Generate Draw', exact: true }).click();
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0)
      .toBe(1);
    const after: any = await getTournamentRecord(page);
    const main = after.events[0].drawDefinitions[0].structures.find((structure: any) => structure.stage === MAIN);
    expect(main.positionAssignments).toHaveLength(64);
    expect(after.sanction.constraints.events[0].drawSize).toBe(32);
  });
  test('Generate cannot discard its waiting list to bypass a sanction alternate cap', async ({ page }) => {
    const topology = await setup(page, { sanctioned: true, alternateLimit: 7 });
    const before = await getTournamentRecord(page);
    await topology.getByRole('button', { name: 'Acceptance line', exact: true }).click();
    await topology.locator('.tb-acceptance[data-stage="MAIN"] .tb-acceptance-row').nth(31).click();
    await topology.getByRole('button', { name: 'Generate Draw', exact: true }).click();
    await expect(
      page.locator('.notification').filter({ hasText: 'No stage space available for entryStatus' }),
    ).toBeVisible();
    expect(await getTournamentRecord(page)).toEqual(before);
  });
  test('an unchanged MAIN cut can move waiting alternates below the qualifying line and Generate keeps them', async ({
    page,
  }) => {
    const topology = await setup(page, { qualifying: 8, mainAlternates: 1, qualifyingAlternates: 1 });
    const before: any = await getTournamentRecord(page);
    const mainAlternate = before.events[0].entries.find(
      (entry: any) => (entry.entryStage ?? MAIN) === MAIN && entry.entryStatus === ALT,
    ).participantId;
    await topology.locator('.tb-proposals-toggle').click();
    await topology.locator('[data-kind="Qualify"]').first().click();
    await topology.getByRole('button', { name: 'Acceptance line', exact: true }).click();
    await topology.locator('.tb-acceptance[data-stage="MAIN"] .tb-acceptance-row').nth(15).click();
    await topology.getByRole('button', { name: 'Qualifying line', exact: true }).click();
    const line = topology.locator('.tb-acceptance[data-stage="QUALIFYING"] [role="slider"]');
    await expect(line).toHaveAttribute('aria-valuenow', '33');
    await line.focus();
    await line.press('ArrowUp');
    await expect(line).toHaveAttribute('aria-valuenow', '32');
    expect(await getTournamentRecord(page)).toEqual(before);
    await topology.getByRole('button', { name: 'Generate Draw', exact: true }).click();
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0)
      .toBe(1);
    const after: any = await getTournamentRecord(page);
    expect(after.events[0].entries.find((entry: any) => entry.participantId === mainAlternate)).toMatchObject({
      entryStage: QUALIFYING,
      entryStatus: ALT,
    });
    expect(
      after.events[0].drawDefinitions[0].entries.filter(
        (entry: any) => entry.entryStage === QUALIFYING && entry.entryStatus === ALT,
      ),
    ).toHaveLength(2);
  });
});
