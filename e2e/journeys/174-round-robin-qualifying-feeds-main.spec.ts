/**
 * Journey 174 — a ROUND_ROBIN qualifying feeds its group winners into MAIN
 *
 * 16 qualifying entrants in 4 groups of 4 produce 4 qualifiers for a 16-position MAIN that holds 12 direct
 * entrants. Every group matchUp is scored through the mutation bridge (`enterScore`, the suite's one score-entry
 * ability), then each MAIN qualifier seat is filled from the draw: click the seat, "Assign qualifier", pick from
 * the offered participants, "Select".
 *
 * The scores are not side-1-always: in every matchUp the side with the greater participantId wins. That is a strict
 * order within each group, so each group has exactly one possible winner, known before the factory tallies anything,
 * and it is not tied to drawPosition 1.
 *
 * Asserted on participantIds and group finishing order, never names:
 * - every participant OFFERED for a qualifier seat is a group winner (groupOrder 1), and every winner is offered;
 * - every qualifier seat ends up filled, each by the winner of a different group;
 * - no participant who did not win a group is placed in MAIN other than the 12 direct entrants.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { enterScore } from '../helpers/enterScore';

const QUALIFIERS = 4;
const GROUP_SIZE = 4;
const MAIN_ENTRIES = 12;
const QUALIFYING_ENTRIES = 16;
const MAIN_DRAW_SIZE = 16;
const TOURNAMENT_ID = 'e2e-rr-qualifying-feeds-main';

type Ids = { tournamentId: string; eventId: string; drawId: string; mainStructureId: string };

/** 12 MAIN + 16 QUALIFYING entries; the draw generated with a ROUND_ROBIN qualifying of 4 groups producing 4 qualifiers. */
async function seedRoundRobinQualifying(page: Page): Promise<Ids> {
  return page.evaluate(
    async ({ tournamentId, mainEntries, qualifyingEntries, drawSize, qualifiers, groupSize }) => {
      await dev.tmx2db.initDB();
      const factory: any = dev.factory;
      const engine = factory.tournamentEngine;
      factory.mocksEngine.generateTournamentRecord({
        participantsProfile: { participantsCount: mainEntries + qualifyingEntries },
        tournamentName: 'E2E RR Qualifying Feeds Main',
        tournamentAttributes: { tournamentId },
        setState: true,
        nonRandom: 1,
      });
      const eventId = engine.addEvent({ event: { eventName: 'Singles', eventType: 'SINGLES' } }).event.eventId;
      const participantIds = engine.getParticipants().participants.map((p: any) => p.participantId);
      engine.addEventEntries({ participantIds: participantIds.slice(0, mainEntries), eventId });
      engine.addEventEntries({ participantIds: participantIds.slice(mainEntries), entryStage: 'QUALIFYING', eventId });
      const result = engine.generateDrawDefinition({
        qualifyingProfiles: [
          {
            structureProfiles: [
              {
                structureOptions: { groupSize },
                qualifyingPositions: qualifiers,
                drawSize: qualifyingEntries,
                drawType: 'ROUND_ROBIN',
              },
            ],
          },
        ],
        automated: true,
        drawSize,
        eventId,
      });
      if (!result.success) throw new Error(JSON.stringify(result.error));
      engine.addDrawDefinition({ eventId, drawDefinition: result.drawDefinition });
      await dev.load({ tournamentRecord: engine.getTournament().tournamentRecord });
      const drawId = result.drawDefinition.drawId;
      const main = result.drawDefinition.structures.find((s: any) => s.stage === 'MAIN');
      return { tournamentId, eventId, drawId, mainStructureId: main.structureId };
    },
    {
      tournamentId: TOURNAMENT_ID,
      mainEntries: MAIN_ENTRIES,
      qualifyingEntries: QUALIFYING_ENTRIES,
      drawSize: MAIN_DRAW_SIZE,
      qualifiers: QUALIFIERS,
      groupSize: GROUP_SIZE,
    },
  );
}

type GroupResult = { matchUpId: string; drawId: string; side1: string; side2: string; winningSide: 1 | 2 };
type Standing = { participantId: string; groupOrder?: number };

/** Every qualifying matchUp with both sides, and which side wins: the greater participantId. */
async function qualifyingResults(page: Page): Promise<GroupResult[]> {
  return page.evaluate(() => {
    const matchUps = dev.factory.tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps ?? [];
    return matchUps
      .filter((m: any) => m.stage === 'QUALIFYING')
      .map((m: any) => {
        const ids: Record<number, string> = {};
        for (const side of m.sides ?? []) ids[side.sideNumber] = side.participantId;
        const [side1, side2] = [ids[1], ids[2]];
        return { matchUpId: m.matchUpId, drawId: m.drawId, side1, side2, winningSide: side1 > side2 ? 1 : 2 };
      });
  });
}

/** Per qualifying group: its participants and the factory's groupOrder for each, read from the held record. */
async function qualifyingGroups(page: Page): Promise<Standing[][]> {
  return page.evaluate(() => {
    const draw = dev.getTournament().events[0].drawDefinitions[0];
    const qualifying = draw.structures.find((s: any) => s.stage === 'QUALIFYING');
    // the tally sits on the assignment (native writeMode) or in its `tally` extension (legacy records)
    const groupOrder = (pa: any) =>
      pa.tally?.groupOrder ?? pa.extensions?.find((x: any) => x.name === 'tally')?.value?.groupOrder;
    return (qualifying?.structures ?? []).map((group: any) =>
      group.positionAssignments.map((pa: any) => ({ participantId: pa.participantId, groupOrder: groupOrder(pa) })),
    );
  });
}

/** MAIN's assignments as the page holds them. */
async function mainAssignments(
  page: Page,
): Promise<{ drawPosition: number; participantId?: string; qualifier: boolean }[]> {
  return page.evaluate(() => {
    const draw = dev.getTournament().events[0].drawDefinitions[0];
    const main = draw.structures.find((s: any) => s.stage === 'MAIN');
    return (main?.positionAssignments ?? []).map((pa: any) => ({
      drawPosition: pa.drawPosition,
      participantId: pa.participantId,
      qualifier: !!pa.qualifier,
    }));
  });
}

/** The rendered seat for `drawPosition` — the participant element, not its side container: side 1's container also
 *  holds the matchUp's scheduling header, so a click at the container's centre can miss the seat. */
const seat = (page: Page, drawPosition: number) => page.locator(`.tmx-p[data-draw-position="${drawPosition}"]`).first();

test.describe('Journey 174 — round robin qualifying feeds MAIN', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('every qualifier placed in MAIN is the winner of a different group', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    const ids = await seedRoundRobinQualifying(page);

    const results = await qualifyingResults(page);
    expect(results.length).toBe((QUALIFYING_ENTRIES / GROUP_SIZE) * ((GROUP_SIZE * (GROUP_SIZE - 1)) / 2));
    expect(results.every((r) => r.side1 && r.side2)).toBe(true);
    for (const r of results) {
      const scoreString = r.winningSide === 1 ? '6-2 6-3' : '2-6 3-6';
      await enterScore(page, { matchUpId: r.matchUpId, drawId: r.drawId, scoreString, winningSide: r.winningSide });
    }

    // the standings the factory computed agree with the strict order the scores imposed
    const groups = await qualifyingGroups(page);
    expect(groups.length).toBe(QUALIFYING_ENTRIES / GROUP_SIZE);
    const winners: string[] = [];
    const nonWinners: string[] = [];
    for (const group of groups) {
      const expectedWinner = group
        .map((p: any) => p.participantId)
        .sort()
        .at(-1);
      const groupWinners = group.filter((p: any) => p.groupOrder === 1).map((p: any) => p.participantId);
      expect(groupWinners).toEqual([expectedWinner]);
      winners.push(expectedWinner);
      nonWinners.push(...group.filter((p: any) => p.participantId !== expectedWinner).map((p: any) => p.participantId));
    }

    const before = await mainAssignments(page);
    const qualifierSeats = before.filter((pa) => pa.qualifier && !pa.participantId).map((pa) => pa.drawPosition);
    expect(qualifierSeats.length).toBe(QUALIFIERS);
    const directEntrants = before.filter((pa) => pa.participantId).map((pa) => pa.participantId);
    expect(directEntrants.length).toBe(MAIN_ENTRIES);

    await page.goto(
      `/#/tournament/${ids.tournamentId}/event/${ids.eventId}/draw/${ids.drawId}/structure/${ids.mainStructureId}`,
    );

    const offered: string[][] = [];
    for (const drawPosition of qualifierSeats) {
      await seat(page, drawPosition).waitFor({ state: 'visible', timeout: 10_000 });
      await seat(page, drawPosition).click();
      await page.locator('.tippy-box[data-state="visible"]').getByText('Assign qualifier', { exact: true }).click();
      await page.locator('.chc-modal-dialog #selectionTable .tabulator-row').first().waitFor({ state: 'visible' });

      offered.push(
        await page.evaluate(() =>
          dev.tournamentContext.tables.selectionTable.getData().map((row: any) => row.participantId),
        ),
      );
      await page.locator('.chc-modal-dialog #selectionTable .tabulator-row').first().click();
      await page.locator('.chc-modal-dialog').getByRole('button', { name: 'Select' }).click();
      await expect
        .poll(async () => (await mainAssignments(page)).find((pa) => pa.drawPosition === drawPosition)?.participantId)
        .toBeTruthy();
    }

    // only winners were ever offered, every winner was offered for the first seat, and each placement used one up
    expect(offered.flat().every((id) => winners.includes(id))).toBe(true);
    expect([...offered[0]].sort()).toEqual([...winners].sort());
    expect(offered.map((list) => list.length)).toEqual([4, 3, 2, 1]);

    const after = await mainAssignments(page);
    const placedQualifiers = after
      .filter((pa) => qualifierSeats.includes(pa.drawPosition))
      .map((pa) => pa.participantId);
    expect(placedQualifiers.every(Boolean)).toBe(true);
    expect([...placedQualifiers].sort()).toEqual([...winners].sort());
    expect(new Set(placedQualifiers).size).toBe(QUALIFIERS);

    const inMain = after.map((pa) => pa.participantId).filter((id): id is string => !!id);
    expect(inMain.length).toBe(MAIN_DRAW_SIZE);
    expect(inMain.filter((id) => nonWinners.includes(id))).toEqual([]);
    expect([...inMain].sort()).toEqual([...directEntrants, ...winners].sort());
  });
});
