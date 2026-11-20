import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { getTournamentRecord, seedTournament } from '../helpers/seed';
import { generateFromTopology } from '../helpers/topologyGenerate';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Qualifying entry routing (CA, 2026-11-18, Mentat/planning/2026-11-17-qualifying-entry-routing.md): the topology
 * decides each qualifying entry's path. Every event here is generated: 24 MAIN entries and 48 QUALIFYING entries,
 * with no path set; the builder's draft is the topology under test.
 */
const QUALIFYING = 'QUALIFYING';
const at = { x: 0, y: 0 };
const qualifyingNode = (id: string, drawSize: number, qualifyingPositions: number) => ({
  id,
  structureName: id,
  stage: QUALIFYING,
  structureType: 'SINGLE_ELIMINATION',
  drawSize,
  qualifyingPositions,
  position: at,
});
const winner = (sourceNodeId: string, targetNodeId: string, targetRoundNumber = 1) => ({
  id: `${sourceNodeId}-${targetNodeId}`,
  sourceNodeId,
  targetNodeId,
  linkType: 'WINNER',
  targetRoundNumber,
});

/** A stronger field of 16 sending 8 to MAIN R3, a weaker of 32 sending 8 to R1; MAIN a 40, seeds unplaced yet. */
const STAGGERED = {
  drawName: 'Open Singles',
  nodes: [
    { id: 'Main', structureName: 'Main', stage: 'MAIN', structureType: 'FEED_IN', drawSize: 40, position: at },
    qualifyingNode('Stronger', 16, 8),
    qualifyingNode('Weaker', 32, 8),
  ],
  edges: [winner('Stronger', 'Main', 3), winner('Weaker', 'Main')],
};

/** MAIN 32; a qualifying 24 (16 of its own, 8 from pre-qualifying) into R1; a pre-qualifying 32 into the qualifying. */
const CHAIN = {
  drawName: 'Open Singles',
  nodes: [
    {
      id: 'Main',
      structureName: 'Main',
      stage: 'MAIN',
      structureType: 'SINGLE_ELIMINATION',
      drawSize: 32,
      position: at,
    },
    qualifyingNode('Qualifying', 24, 8),
    qualifyingNode('Pre', 32, 8),
  ],
  edges: [winner('Pre', 'Qualifying'), winner('Qualifying', 'Main')],
};

async function setup(page: Page, draft: any) {
  const tournamentId = await seedTournament(page, {
    tournamentName: 'Qualifying Routing E2E',
    tournamentAttributes: { tournamentId: 'e2e-qualifying-routing' },
    participantsProfile: { participantsCount: 72 },
    eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 24 } }],
  });
  const eventId = await page.evaluate(async (draft) => {
    const record: any = dev.getTournament();
    const event = record.events[0];
    const entered = new Set(event.entries.map((entry: any) => entry.participantId));
    const ids = record.participants
      .filter((p: any) => !entered.has(p.participantId))
      .slice(0, 48)
      .map((p: any) => p.participantId);
    const result = dev.factory.tournamentEngine.addEventEntries({
      eventId: event.eventId,
      participantIds: ids,
      entryStage: 'QUALIFYING',
    });
    if (!result.success) throw new Error(JSON.stringify(result));
    await dev.load(dev.getTournament());
    dev.context({ internal: true });
    // the builder opens the event's kept draft: the topology under test
    const drafts = '/src/pages/tournament/topologyDrafts.ts';
    (await import(drafts)).keepTopologyDraft(event.eventId, draft);
    return event.eventId;
  }, draft);
  await page.goto(`/#/tournament/${tournamentId}/topology/${eventId}`);
  const topology = page.locator('#tmxTopology');
  await expect(topology.locator('button.tb-mode-toggle[data-mode="fit"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(topology.locator('.tb-card')).toHaveCount(draft.nodes.length);
  return topology;
}

/** The entries' paths after Generate: participantId → [entryStageSequence, roundTarget]. */
function paths(record: any): Map<string, [number | undefined, number | undefined]> {
  return new Map(
    record.events[0].entries
      .filter((entry: any) => entry.entryStage === QUALIFYING)
      .map((entry: any) => [
        entry.participantId,
        [
          entry.entryStageSequence,
          entry.roundTarget ?? entry.extensions?.find((x: any) => x.name === 'roundTarget')?.value,
        ],
      ]),
  );
}

/**
 * The Entries tab's Path column after Generate (read-only): its header, and a cell for each label. The table draws only
 * the rows near its view, and the qualifying entries follow the MAIN ones, so it is scrolled until each is drawn.
 */
async function expectPathColumn(page: Page, labels: string[]) {
  await page.locator('#eventTabsBar .event-tab-btn', { hasText: 'Entries' }).click();
  await expect(page.locator('.tabulator-col[tabulator-field="qualifyingPath"]').first()).toBeVisible();
  const holder = page.locator('.tabulator-tableholder').first();
  for (const label of labels) {
    const cell = page.locator('.tabulator-cell[tabulator-field="qualifyingPath"]', { hasText: label });
    await expect
      .poll(async () => {
        if (await cell.count()) return true;
        await holder.evaluate((el) => el.scrollBy(0, 300));
        return false;
      })
      .toBe(true);
  }
}

const countOf = (values: any[][], path: any[]) => values.filter((v) => v[0] === path[0] && v[1] === path[1]).length;

test.describe('Topology — qualifying entry routing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('a stronger field routed to R3: Main stacks a feed round for the seeds, Generate writes each band', async ({
    page,
  }) => {
    const topology = await setup(page, STAGGERED);
    const card = (name: string) =>
      topology.locator('.tb-card').filter({ has: page.locator('.tb-card-name', { hasText: new RegExp(`^${name}$`) }) });

    // the 40's 8 fed positions at R3 are the seeds': the stronger field's qualifiers have none
    await expect(card('Main').locator('.tb-late-entry-text')).toContainText('R3 needs');
    await card('Main').locator('.tb-late-entry-stack').click();
    await expect(card('Main').locator('.tb-card-size')).toHaveText('×48');
    await expect(card('Main').locator('.tb-late-entry')).toHaveCount(0);
    await expect(card('Stronger').locator('.tb-card-advance')).toHaveText('Qualifying → R3 · 8 sections of 2');

    // the qualifying list in bands, strongest first
    await topology.getByRole('button', { name: 'Qualifying line', exact: true }).click();
    await expect(page.locator('.tb-acceptance[data-stage="QUALIFYING"] .tb-acceptance-slot')).toHaveText([
      'Stronger · Qualifying → R3 · 16',
      'Weaker · Qualifying → R1 · 32',
    ]);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(async (theme) => {
        const path = '/src/services/theme/themeService.ts';
        (await import(path)).applyTheme(theme);
      }, theme);
      await page.screenshot({ path: test.info().outputPath(`routing-${theme}.png`) });
    }

    const collector = createMutationCollector(page);
    await generateFromTopology(page, topology);
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0)
      .toBe(1);

    // the paths are written in the request that adds the draw, before it
    const queue = collector
      .getMutations()
      .find((mutation) => mutation.methods.some((method) => method.method === 'addDrawDefinition'))!;
    const methods = queue.methods.map((method) => method.method);
    expect(methods.filter((m) => m === 'setEntryQualifyingPath')).toHaveLength(2);
    expect(methods.lastIndexOf('setEntryQualifyingPath')).toBeLessThan(methods.indexOf('addDrawDefinition'));
    collector.detach();

    const record: any = await getTournamentRecord(page);
    const values = [...paths(record).values()];
    expect(countOf(values, [1, 3])).toBe(16);
    expect(countOf(values, [1, 1])).toBe(32);
    const structures = record.events[0].drawDefinitions[0].structures;
    expect(structures.find((s: any) => s.stage === 'MAIN').positionAssignments).toHaveLength(48);
    expect(structures.filter((s: any) => s.stage === QUALIFYING)).toHaveLength(2);

    // the entries page shows each qualifying entry's path, read-only (CA, 2026-11-18)
    await expectPathColumn(page, ['Qualifying · R3', 'Qualifying · R1']);
  });

  test('a pre-qualifying chain: the qualifying band is sequence 2, pre-qualifying 1, every entrant placed', async ({
    page,
  }) => {
    const topology = await setup(page, CHAIN);
    const card = (name: string) =>
      topology.locator('.tb-card').filter({ has: page.locator('.tb-card-name', { hasText: new RegExp(`^${name}$`) }) });
    await expect(card('Pre').locator('.tb-card-advance')).toHaveText('Pre-qualifying → Qualifying · 8 sections of 4');

    await generateFromTopology(page, topology);
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0)
      .toBe(1);

    const record: any = await getTournamentRecord(page);
    const values = [...paths(record).values()];
    expect(countOf(values, [2, 1])).toBe(16);
    expect(countOf(values, [1, 1])).toBe(32);
    const qualifying = record.events[0].drawDefinitions[0].structures.filter((s: any) => s.stage === QUALIFYING);
    const placed = (name: string) =>
      qualifying.find((s: any) => s.structureName === name).positionAssignments.filter((a: any) => a.participantId)
        .length;
    expect(placed('Pre')).toBe(32);
    expect(placed('Qualifying')).toBe(16);

    await expectPathColumn(page, ['Pre-qualifying → Qualifying · R1', 'Qualifying · R1']);
  });
});
