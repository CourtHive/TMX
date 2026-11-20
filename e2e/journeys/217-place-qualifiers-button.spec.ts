/**
 * Journey 217 — a [Place qualifiers] button on the main structure once qualifiers wait (CA, 2026-11-19)
 *
 * Placing qualifiers lived only in the [Actions] menu, where a director did not find it. The control bar now carries
 * a button while qualified participants wait for the viewed main structure's qualifier positions, and no Actions entry.
 *
 * A 16 for 4 elimination qualifying feeds a 16 MAIN of 12 direct entrants. Before any qualifying result there is no
 * button; with the qualifying played out the button shows, places every qualifier by lot, and goes away.
 *
 * A qualifying stage pre-qualifying feeds has qualifier positions of its own: viewed, it shows the same button once
 * the pre-qualifying is played, and fills them (factory 7.43.0 `qualifierProgression` with the stage's structureId).
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

const TOURNAMENT_ID = 'e2e-place-qualifiers-button';
const QUALIFIERS = 4;
const BUTTON = '#placeQualifiersButton';

type Ids = { tournamentId: string; eventId: string; drawId: string; mainStructureId: string };

/** 12 MAIN + 16 QUALIFYING entries, a 16 for 4 qualifying; `playQualifying` scores every qualifying matchUp, side 1. */
async function seed(page: Page, playQualifying: boolean): Promise<Ids> {
  return page.evaluate(
    async ({ tournamentId, qualifiers, playQualifying }) => {
      await dev.tmx2db.initDB();
      const factory: any = dev.factory;
      const engine = factory.tournamentEngine;
      factory.mocksEngine.generateTournamentRecord({
        participantsProfile: { participantsCount: 28 },
        tournamentName: 'E2E Place Qualifiers Button',
        tournamentAttributes: { tournamentId },
        setState: true,
        nonRandom: 1,
      });
      const eventId = engine.addEvent({ event: { eventName: 'Singles', eventType: 'SINGLES' } }).event.eventId;
      const participantIds = engine.getParticipants().participants.map((p: any) => p.participantId);
      engine.addEventEntries({ participantIds: participantIds.slice(0, 12), eventId });
      engine.addEventEntries({ participantIds: participantIds.slice(12), entryStage: 'QUALIFYING', eventId });
      const result = engine.generateDrawDefinition({
        qualifyingProfiles: [{ structureProfiles: [{ qualifyingPositions: qualifiers, drawSize: 16 }] }],
        automated: true,
        drawSize: 16,
        eventId,
      });
      if (!result.success) throw new Error(JSON.stringify(result.error));
      engine.addDrawDefinition({ eventId, drawDefinition: result.drawDefinition });
      const drawId = result.drawDefinition.drawId;

      // round by round: each round's matchUps have both sides once the round before is scored
      const { outcome } = factory.mocksEngine.generateOutcomeFromScoreString({
        scoreString: '6-1 6-1',
        winningSide: 1,
      });
      for (let pass = 0; playQualifying && pass < 2; pass++) {
        const ready = engine
          .allTournamentMatchUps({ inContext: true })
          .matchUps.filter((m: any) => m.stage === 'QUALIFYING' && m.readyToScore && !m.winningSide);
        for (const m of ready) engine.setMatchUpStatus({ matchUpId: m.matchUpId, drawId, outcome });
      }

      await dev.load({ tournamentRecord: engine.getTournament().tournamentRecord });
      const main = result.drawDefinition.structures.find((s: any) => s.stage === 'MAIN');
      return { tournamentId, eventId, drawId, mainStructureId: main.structureId };
    },
    { tournamentId: TOURNAMENT_ID, qualifiers: QUALIFIERS, playQualifying },
  );
}

/** MAIN's qualifier positions still waiting for a participant. */
async function openQualifierPositions(page: Page): Promise<number> {
  return page.evaluate(() => {
    const draw = dev.getTournament().events[0].drawDefinitions[0];
    const main = draw.structures.find((s: any) => s.stage === 'MAIN');
    return main.positionAssignments.filter((pa: any) => pa.qualifier && !pa.participantId).length;
  });
}

/** Pre-qualifying (8 → 2) feeds qualifying (8, two qualifier positions), which feeds an 8 MAIN; every playable
 *  matchUp played, so the two pre-qualifying winners wait for the qualifying stage. */
async function seedPreQualifying(page: Page): Promise<Ids & { qualifyingStructureId: string }> {
  return page.evaluate(async (tournamentId) => {
    await dev.tmx2db.initDB();
    const factory: any = dev.factory;
    const { tournamentRecord, drawIds, eventIds } = factory.mocksEngine.generateTournamentRecord({
      tournamentAttributes: { tournamentId },
      drawProfiles: [
        {
          drawSize: 8,
          qualifyingProfiles: [
            {
              roundTarget: 1,
              structureProfiles: [
                { stageSequence: 1, drawSize: 8, qualifyingPositions: 2 },
                { stageSequence: 2, drawSize: 8, qualifyingPositions: 2 },
              ],
            },
          ],
        },
      ],
      completeAllMatchUps: true,
    });
    await dev.load({ tournamentRecord });
    const drawDefinition = tournamentRecord.events[0].drawDefinitions[0];
    const of = (stage: string, stageSequence: number) =>
      drawDefinition.structures.find((s: any) => s.stage === stage && s.stageSequence === stageSequence).structureId;
    return {
      tournamentId,
      eventId: eventIds[0],
      drawId: drawIds[0],
      mainStructureId: of('MAIN', 1),
      qualifyingStructureId: of('QUALIFYING', 2),
    };
  }, `${TOURNAMENT_ID}-chain`);
}

/** A structure's qualifier positions still waiting for a participant. */
async function openPositionsIn(page: Page, structureId: string): Promise<number> {
  return page.evaluate((structureId) => {
    const draw = dev.getTournament().events[0].drawDefinitions[0];
    const structure = draw.structures.find((s: any) => s.structureId === structureId);
    return structure.positionAssignments.filter((pa: any) => pa.qualifier && !pa.participantId).length;
  }, structureId);
}

const mainUrl = (ids: Ids) =>
  `/#/tournament/${ids.tournamentId}/event/${ids.eventId}/draw/${ids.drawId}/structure/${ids.mainStructureId}`;

test.describe('Journey 217 — Place qualifiers button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('no button while nobody has qualified', async ({ page }) => {
    const ids = await seed(page, false);
    await page.goto(mainUrl(ids));
    await page.locator('.tmx-p').first().waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator(BUTTON)).toHaveCount(0);
  });

  test('the button places every waiting qualifier, then goes away', async ({ page }) => {
    const ids = await seed(page, true);
    expect(await openQualifierPositions(page)).toBe(QUALIFIERS);
    // the qualifying is played out: its final round has a winner in every matchUp
    const finalRoundWinners = await page.evaluate(
      () =>
        dev.factory.tournamentEngine
          .allTournamentMatchUps({ inContext: true })
          .matchUps.filter((m: any) => m.stage === 'QUALIFYING' && m.roundNumber === 2 && m.winningSide).length,
    );
    expect(finalRoundWinners).toBe(QUALIFIERS);

    await page.goto(mainUrl(ids));
    const button = page.locator(BUTTON);
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click();
    await page.locator('.chc-modal-dialog').getByRole('button', { name: 'OK' }).click();

    await expect.poll(() => openQualifierPositions(page)).toBe(0);
    // the summary of who went where, then the bar without the button
    await page.locator('.chc-modal-dialog').getByRole('button', { name: 'OK' }).click();
    await expect(button).toHaveCount(0);
  });

  test('a qualifying stage pre-qualifying feeds gets the button, and it fills that stage', async ({ page }) => {
    const ids = await seedPreQualifying(page);
    expect(await openPositionsIn(page, ids.qualifyingStructureId)).toBe(2);
    const mainOpen = await openPositionsIn(page, ids.mainStructureId);

    await page.goto(
      `/#/tournament/${ids.tournamentId}/event/${ids.eventId}/draw/${ids.drawId}/structure/${ids.qualifyingStructureId}`,
    );
    const button = page.locator(BUTTON);
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click();
    await page.locator('.chc-modal-dialog').getByRole('button', { name: 'OK' }).click();

    await expect.poll(() => openPositionsIn(page, ids.qualifyingStructureId)).toBe(0);
    // MAIN is not touched: its qualifiers come from the qualifying stage, still to be played
    expect(await openPositionsIn(page, ids.mainStructureId)).toBe(mainOpen);
    await page.locator('.chc-modal-dialog').getByRole('button', { name: 'OK' }).click();
    await expect(button).toHaveCount(0);
  });
});
