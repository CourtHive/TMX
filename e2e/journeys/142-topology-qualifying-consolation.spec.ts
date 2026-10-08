import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

/**
 * Journey 142 — a consolation for the losers of QUALIFYING round 1, built from a shipped template.
 *
 * The ITA DI Men's Carolina Regional (CA, 2026-10-07): a 64 main fed by a 64 qualifying with 16
 * qualifiers, and the losers of qualifying round 1 play a consolation. No generator produces that in
 * one call, so the topology converter defers the consolation and names its SOURCE node; TMX used to
 * attach every deferred consolation to the MAIN structure, and the draw-type select never offered the
 * templates that ship with courthive-components at all. Asserted here, through the real "Add draw":
 *  1. the shipped template is offered in the draw-type select;
 *  2. generating from it yields MAIN 64, QUALIFYING 64 with every qualifying entry PLACED and 16 seed slots,
 *     and a CONSOLATION of 32;
 *  3. the LOSER link into the consolation comes FROM THE QUALIFYING structure, not the main;
 *  4. scoring a qualifying round-1 match puts its loser into the consolation.
 */
const TEMPLATE_NAME = 'Single Elimination + Qualifying with consolation';
const TEMPLATE_VALUE = `TOPOLOGY_TEMPLATE:${TEMPLATE_NAME}`;
const MAIN_ENTRIES = 48;
const QUALIFYING_ENTRIES = 64;
const QUALIFYING_SEEDS = 16;
const CONSOLATION_SIZE = 32;
const TOURNAMENT_ID = 'e2e-topology-q-consolation';

type DrawShape = {
  drawId: string;
  structures: {
    stage: string;
    structureName: string;
    structureId: string;
    positions: number;
    placed: number;
    seeds: number;
  }[];
  links: { linkType: string; sourceStage: string; targetStage: string; sourceRound: number }[];
};

async function seed(page: Page): Promise<string> {
  return page.evaluate(
    async ({ tournamentId, mainEntries, qualifyingEntries }) => {
      await dev.tmx2db.initDB();
      const engine = dev.factory.tournamentEngine;
      const { eventIds } = dev.factory.mocksEngine.generateTournamentRecord({
        participantsProfile: { participantsCount: mainEntries + qualifyingEntries },
        tournamentAttributes: { tournamentId },
        eventProfiles: [{ eventName: 'Singles' }],
        tournamentName: 'E2E Qualifying Consolation',
        setState: true,
        nonRandom: 1,
      });
      const eventId = eventIds[0];
      const ids = engine.getParticipants().participants.map((p: any) => p.participantId);
      engine.addEventEntries({ eventId, participantIds: ids.slice(0, mainEntries), entryStage: 'MAIN' });
      engine.addEventEntries({ eventId, participantIds: ids.slice(mainEntries), entryStage: 'QUALIFYING' });
      const tournamentRecord = engine.getTournament().tournamentRecord;
      await dev.load({ tournamentRecord });
      return tournamentRecord.tournamentId as string;
    },
    { tournamentId: TOURNAMENT_ID, mainEntries: MAIN_ENTRIES, qualifyingEntries: QUALIFYING_ENTRIES },
  );
}

async function readDraw(page: Page): Promise<DrawShape | undefined> {
  return page.evaluate(() => {
    const event: any = dev.factory.tournamentEngine.getEvents().events?.[0];
    const draw: any = event?.drawDefinitions?.[0];
    if (!draw) return undefined;
    const stageOf = (structureId: string) => draw.structures.find((s: any) => s.structureId === structureId)?.stage;
    return {
      drawId: draw.drawId,
      structures: draw.structures.map((s: any) => ({
        stage: s.stage,
        structureName: s.structureName,
        structureId: s.structureId,
        positions: s.positionAssignments?.length ?? 0,
        placed: (s.positionAssignments ?? []).filter((a: any) => a.participantId).length,
        // seed SLOTS: mock participants carry no rankings, so no seed is placed, but the template's count is
        seeds: s.seedAssignments?.length ?? 0,
      })),
      links: (draw.links ?? []).map((l: any) => ({
        linkType: l.linkType,
        sourceStage: stageOf(l.source.structureId),
        targetStage: stageOf(l.target.structureId),
        sourceRound: l.source.roundNumber,
      })),
    };
  });
}

/** Score the first fully populated qualifying round-1 match through the app's mutation path; returns the loser. */
async function scoreOneQualifyingMatch(page: Page, drawId: string, qualifyingStructureId: string): Promise<string> {
  return page.evaluate(
    async ({ drawId, qualifyingStructureId }) => {
      const engine = dev.factory.tournamentEngine;
      const matchUp: any = engine
        .allDrawMatchUps({ drawId, inContext: true })
        .matchUps.find(
          (m: any) =>
            m.structureId === qualifyingStructureId &&
            m.roundNumber === 1 &&
            m.sides?.every((side: any) => side.participantId),
        );
      await new Promise<void>((resolve) =>
        dev.mutationRequest({
          methods: [
            {
              method: 'setMatchUpStatus',
              params: {
                drawId,
                matchUpId: matchUp.matchUpId,
                outcome: {
                  winningSide: 1,
                  matchUpStatus: 'COMPLETED',
                  score: {
                    sets: [
                      { setNumber: 1, side1Score: 6, side2Score: 1, winningSide: 1 },
                      { setNumber: 2, side1Score: 6, side2Score: 2, winningSide: 1 },
                    ],
                  },
                },
              },
            },
          ],
          callback: () => resolve(),
        }),
      );
      return matchUp.sides[1].participantId as string;
    },
    { drawId, qualifyingStructureId },
  );
}

async function consolationParticipantIds(
  page: Page,
  drawId: string,
  consolationStructureId: string,
): Promise<string[]> {
  return page.evaluate(
    ({ drawId, consolationStructureId }) =>
      dev.factory.tournamentEngine
        .allDrawMatchUps({ drawId, inContext: true })
        .matchUps.filter((m: any) => m.structureId === consolationStructureId)
        .flatMap((m: any) => m.sides ?? [])
        .map((side: any) => side.participantId)
        .filter(Boolean),
    { drawId, consolationStructureId },
  );
}

async function openAddDraw(page: Page, tournamentId: string): Promise<DrawFormDrawer> {
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

test.describe('journey 142 — qualifying consolation from a shipped topology template', () => {
  test('the template is offered, the consolation hangs off the qualifying, and a round-1 loser lands in it', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);

    const tournamentId = await seed(page);
    const collector = createMutationCollector(page);
    const drawer = await openAddDraw(page, tournamentId);

    // 1. the shipped template reaches the select without being saved first
    const offered = await drawer.getSelectOptionValues('Draw Type');
    expect(offered).toContain(TEMPLATE_VALUE);

    await drawer.selectDrawType(TEMPLATE_VALUE);
    await drawer.clickGenerate();
    await collector.waitForMethod('addDrawDefinition', 15_000);
    await collector.waitForMethod('attachConsolationStructures', 15_000);
    collector.detach();

    // 2. three structures; every qualifying entry placed, with the template's seeds
    await expect.poll(async () => (await readDraw(page))?.structures.length, { timeout: 10_000 }).toBe(3);
    const draw = (await readDraw(page))!;
    const byStage = (stage: string) => draw.structures.find((s) => s.stage === stage)!;
    expect(byStage('MAIN').positions).toBe(64);
    expect(byStage('MAIN').placed).toBe(MAIN_ENTRIES);
    expect(byStage('QUALIFYING').positions).toBe(QUALIFYING_ENTRIES);
    expect(byStage('QUALIFYING').placed).toBe(QUALIFYING_ENTRIES);
    expect(byStage('QUALIFYING').seeds).toBe(QUALIFYING_SEEDS);
    expect(byStage('CONSOLATION').positions).toBe(CONSOLATION_SIZE);

    // 3. the LOSER link into the consolation leaves the QUALIFYING structure at round 1
    const loserLinks = draw.links.filter((l) => l.linkType === 'LOSER');
    expect(loserLinks).toEqual([
      { linkType: 'LOSER', sourceStage: 'QUALIFYING', targetStage: 'CONSOLATION', sourceRound: 1 },
    ]);
    expect(draw.links.filter((l) => l.linkType === 'WINNER')).toEqual([
      { linkType: 'WINNER', sourceStage: 'QUALIFYING', targetStage: 'MAIN', sourceRound: expect.any(Number) },
    ]);

    // 4. the loser of a qualifying round-1 match is fed into the consolation
    const consolationId = byStage('CONSOLATION').structureId;
    expect(await consolationParticipantIds(page, draw.drawId, consolationId)).toEqual([]);
    const loser = await scoreOneQualifyingMatch(page, draw.drawId, byStage('QUALIFYING').structureId);
    await expect
      .poll(() => consolationParticipantIds(page, draw.drawId, consolationId), { timeout: 10_000 })
      .toEqual([loser]);
  });
});
