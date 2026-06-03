/**
 * Journey 42 — Generate Qualifying from the Draws view
 *
 * Regression coverage for the "Generate qualifying" button rendered by
 * `renderEmptyStructure` when the selected structure is a QUALIFYING
 * placeholder with no matchUps.
 *
 * Prior bug: pressing Generate Qualifying submitted a
 * `tournamentEngine.generateDrawDefinition` with `qualifyingProfiles` on an
 * existing draw. When the QUALIFYING placeholder had been stripped (or never
 * created) the factory tried to regenerate MAIN and failed with one of
 * ERR_EXISTING_STAGE / ERR_INVALID_DRAW_SIZE / ERR_NOT_FOUND_STRUCTURE
 * (the last with `stack: ['prepareStage']` from the qualifying-stage lookup).
 *
 * The factory-level fix routes "existing main + qualifyingProfiles" through
 * `processExistingDrawDefinition`. This journey replays the exact mutation
 * the TMX "Generate qualifying" submit fires, and asserts that the local
 * factory call succeeds for both shapes the UI can be in: with and without
 * an existing qualifying placeholder.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady, ensureDrawsTableMode } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';

const PROFILE_WITH_PLACEHOLDER: MockProfile = {
  tournamentName: 'E2E Generate Qualifying — placeholder',
  tournamentAttributes: { tournamentId: 'e2e-gen-qualifying-pl' },
  participantsProfile: { scaledParticipantsCount: 80 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 32,
      drawType: 'SINGLE_ELIMINATION',
      qualifyingPlaceholder: true,
      qualifiersCount: 8,
      participantsCount: 24,
    },
  ],
};

const PROFILE_WITHOUT_PLACEHOLDER: MockProfile = {
  tournamentName: 'E2E Generate Qualifying — no placeholder',
  tournamentAttributes: { tournamentId: 'e2e-gen-qualifying-np' },
  participantsProfile: { scaledParticipantsCount: 80 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 32,
      drawType: 'SINGLE_ELIMINATION',
      qualifyingPlaceholder: true,
      qualifiersCount: 8,
      participantsCount: 24,
    },
  ],
};

/** Add `count` qualifying-stage entries to the first draw of the first
 *  event and resync TMX/IndexedDB. */
async function seedQualifyingEntries(page: any, drawId: string, count: number): Promise<void> {
  await page.evaluate(
    ({ drawId, count }: { drawId: string; count: number }) => {
      const engine = (dev as any).factory.tournamentEngine;
      const { participants } = engine.getParticipants();
      const { event } = engine.getEvent({ drawId });
      const taken = new Set((event.entries ?? []).map((e: any) => e.participantId));
      const ids = participants
        .map((p: any) => p.participantId)
        .filter((id: string) => !taken.has(id))
        .slice(0, count);
      engine.addEventEntries({ participantIds: ids, entryStage: 'QUALIFYING', eventId: event.eventId });
      const tr = (dev as any).getTournament();
      (dev as any).load(tr);
    },
    { drawId, count },
  );
}

/** Strip the qualifying placeholder structure out of the seeded record,
 *  reproducing the user-reported tournamentRecord shape (only MAIN, but
 *  qualifier-positions reserved + dangling link). */
async function stripQualifyingPlaceholder(page: any, drawId: string): Promise<void> {
  await page.evaluate(
    ({ drawId }: { drawId: string }) => {
      const tr = (dev as any).getTournament();
      const dd = tr.events[0].drawDefinitions.find((d: any) => d.drawId === drawId);
      dd.structures = dd.structures.filter((s: any) => s.stage !== 'QUALIFYING');
      // intentionally leave dangling links pointing at the removed placeholder
      const engine = (dev as any).factory.tournamentEngine;
      engine.setState(tr);
      (dev as any).load(tr);
    },
    { drawId },
  );
}

/** Replay the local `tournamentEngine.generateDrawDefinition` call that
 *  TMX's submitDrawParams + generateDraw fire when "Generate qualifying"
 *  is submitted with `isQualifying: true`, no top-level drawSize/drawType,
 *  and the existing drawId. */
async function callGenerateQualifying(page: any, drawId: string): Promise<any> {
  return page.evaluate(
    ({ drawId }: { drawId: string }) => {
      const engine = (dev as any).factory.tournamentEngine;
      const { event } = engine.getEvent({ drawId });
      const drawEntries = (event.entries ?? []).filter((e: any) => e.entryStage === 'QUALIFYING');
      return engine.generateDrawDefinition({
        drawEntries,
        qualifyingProfiles: [
          {
            structureProfiles: [
              {
                qualifyingPositions: 8,
                drawSize: 24,
                drawType: 'SINGLE_ELIMINATION',
                seedsCount: 8,
                structureName: 'Qualifying',
                matchUpFormat: 'SET3-S:6/TB7',
              },
            ],
          },
        ],
        drawName: 'Draw 1',
        ignoreStageSpace: true,
        automated: true,
        eventId: event.eventId,
        drawId,
      });
    },
    { drawId },
  );
}

async function getFirstDrawId(page: any): Promise<string> {
  return page.evaluate(() => {
    const tr = (dev as any).getTournament();
    return tr.events[0].drawDefinitions[0].drawId as string;
  });
}

test.describe('Journey 42 — Generate qualifying mutation succeeds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test('with existing qualifying placeholder', async ({ page }) => {
    await seedTournament(page, PROFILE_WITH_PLACEHOLDER);
    const drawId = await getFirstDrawId(page);
    await seedQualifyingEntries(page, drawId, 24);

    const result = await callGenerateQualifying(page, drawId);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const qualifyingHasMatchUps = await page.evaluate((drawId) => {
      const engine = (dev as any).factory.tournamentEngine;
      const dd = engine.getEvent({ drawId }).drawDefinition;
      const qualifying = dd?.structures?.find((s: any) => s.stage === 'QUALIFYING');
      return Boolean(qualifying?.matchUps?.length);
    }, drawId);
    expect(qualifyingHasMatchUps).toBe(true);
  });

  test('without a qualifying placeholder (user-reported broken shape)', async ({ page }) => {
    await seedTournament(page, PROFILE_WITHOUT_PLACEHOLDER);
    const drawId = await getFirstDrawId(page);
    await seedQualifyingEntries(page, drawId, 24);
    await stripQualifyingPlaceholder(page, drawId);

    // Sanity: only MAIN remains, qualifier positions reserved, dangling link.
    const sanity = await page.evaluate((drawId) => {
      const engine = (dev as any).factory.tournamentEngine;
      const dd = engine.getEvent({ drawId }).drawDefinition;
      const stages = dd.structures.map((s: any) => s.stage);
      const ids = new Set(dd.structures.map((s: any) => s.structureId));
      const dangling = (dd.links ?? []).filter((l: any) => !ids.has(l.source.structureId));
      const main = dd.structures.find((s: any) => s.stage === 'MAIN');
      const qualifierSlots = main?.positionAssignments?.filter((p: any) => p.qualifier).length ?? 0;
      return { stages, danglingCount: dangling.length, qualifierSlots };
    }, drawId);
    expect(sanity.stages).toEqual(['MAIN']);
    expect(sanity.qualifierSlots).toBeGreaterThan(0);
    expect(sanity.danglingCount).toBeGreaterThan(0);

    const result = await callGenerateQualifying(page, drawId);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const post = await page.evaluate((drawId) => {
      const engine = (dev as any).factory.tournamentEngine;
      const dd = engine.getEvent({ drawId }).drawDefinition;
      const qualifying = dd.structures.find((s: any) => s.stage === 'QUALIFYING');
      const ids = new Set(dd.structures.map((s: any) => s.structureId));
      const dangling = dd.links.filter((l: any) => !ids.has(l.source.structureId));
      return { qualifyingMatchUps: qualifying?.matchUps?.length ?? 0, danglingAfter: dangling.length };
    }, drawId);
    expect(post.qualifyingMatchUps).toBeGreaterThan(0);
    expect(post.danglingAfter).toBe(0);
  });
});
