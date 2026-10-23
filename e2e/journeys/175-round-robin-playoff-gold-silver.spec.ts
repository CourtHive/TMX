/**
 * Journey 175 — a ROUND_ROBIN_WITH_PLAYOFF main feeds each finishing position into its own playoff
 *
 * The draw is made in the add-draw drawer: Round Robin with Playoff, 16 entries in groups of 4, Playoff Type
 * "Positions", which creates one playoff per finishing position — "Playoff 1" takes the group winners (Gold),
 * "Playoff 2" the runners-up (Silver), and so on. Every group matchUp is scored through the mutation bridge
 * (`enterScore`, the suite's one score-entry ability), then the playoffs are positioned with the "Auto position"
 * button the draw control bar offers on a playoff structure.
 *
 * The scores are not side-1-always: in every matchUp the side with the greater participantId wins. That is a strict
 * order within each group, so each finishing position is known before the factory tallies anything.
 *
 * Asserted on participantIds and group finishing order, never names: Gold holds exactly the group winners, Silver
 * exactly the runners-up (and 3rd and 4th likewise), no one is in two playoffs and no one is missing.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, type MockProfile } from '../helpers/seed';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { enterScore } from '../helpers/enterScore';
import { S } from '../helpers/selectors';

const ENTRIES = 16;
const GROUP_SIZE = 4;
const GROUPS = ENTRIES / GROUP_SIZE;
const GOLD = 'Playoff 1';
const SILVER = 'Playoff 2';
const AUTO_POSITION = 'Auto position';

const PROFILE_EVENT_NO_DRAW: MockProfile = {
  tournamentName: 'E2E RR Playoff Gold Silver',
  tournamentAttributes: { tournamentId: 'e2e-rr-playoff-gold-silver' },
  participantsProfile: { scaledParticipantsCount: ENTRIES },
  drawProfiles: [{ eventName: 'Singles', drawSize: ENTRIES, generate: false }],
};

/** The draw and its structures as the page holds them; each playoff with the participants placed in it. */
type StructureState = {
  structureId: string;
  structureName: string;
  stage: string;
  stageSequence: number;
  groups: number;
  participantIds: string[];
};
type DrawState = { eventId: string; drawId: string; drawType?: string; structures: StructureState[] };

async function drawState(page: Page): Promise<DrawState> {
  return page.evaluate(() => {
    const event = dev.getTournament().events[0];
    const draw = event.drawDefinitions?.[0];
    const structures = (draw?.structures ?? []).map((s: any) => ({
      structureId: s.structureId,
      structureName: s.structureName,
      stage: s.stage,
      stageSequence: s.stageSequence,
      groups: (s.structures ?? []).length,
      participantIds: (s.positionAssignments ?? []).map((pa: any) => pa.participantId).filter(Boolean),
    }));
    return { eventId: event.eventId, drawId: draw?.drawId, drawType: draw?.drawType, structures };
  });
}

type GroupResult = { matchUpId: string; drawId: string; side1: string; side2: string; winningSide: 1 | 2 };
type Standing = { participantId: string; groupOrder?: number };

/** Every group matchUp with both sides, and which side wins: the greater participantId. */
async function groupResults(page: Page, structureId: string): Promise<GroupResult[]> {
  return page.evaluate((containerId) => {
    const matchUps = dev.factory.tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps ?? [];
    return matchUps
      .filter((m: any) => m.containerStructureId === containerId)
      .map((m: any) => {
        const ids: Record<number, string> = {};
        for (const side of m.sides ?? []) ids[side.sideNumber] = side.participantId;
        const [side1, side2] = [ids[1], ids[2]];
        return { matchUpId: m.matchUpId, drawId: m.drawId, side1, side2, winningSide: side1 > side2 ? 1 : 2 };
      });
  }, structureId);
}

/** Per group: its participants and the factory's groupOrder for each, read from the held record. */
async function groupStandings(page: Page, structureId: string): Promise<Standing[][]> {
  return page.evaluate((containerId) => {
    const draw = dev.getTournament().events[0].drawDefinitions[0];
    const container = draw.structures.find((s: any) => s.structureId === containerId);
    // the tally sits on the assignment (native writeMode) or in its `tally` extension (legacy records)
    const groupOrder = (pa: any) =>
      pa.tally?.groupOrder ?? pa.extensions?.find((x: any) => x.name === 'tally')?.value?.groupOrder;
    return (container?.structures ?? []).map((group: any) =>
      group.positionAssignments.map((pa: any) => ({ participantId: pa.participantId, groupOrder: groupOrder(pa) })),
    );
  }, structureId);
}

/** Seed an event with 16 entries and no draw, then make the draw in the add-draw drawer: Round Robin with Playoff,
 *  groups of 4, Playoff Type "Positions". `playoffDrawType` is chosen only when given. */
async function addRoundRobinWithPlayoffDraw(page: Page, { playoffDrawType }: { playoffDrawType?: string } = {}) {
  const tournamentId = await seedTournament(page, PROFILE_EVENT_NO_DRAW);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();

  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  await drawer.selectDrawType('ROUND_ROBIN_WITH_PLAYOFF');
  await drawer.fieldSelect('Group size').selectOption(String(GROUP_SIZE));
  await drawer.fieldSelect('Playoff Type').selectOption('positions');
  if (playoffDrawType) await drawer.fieldSelect('Playoff Draw Type').selectOption(playoffDrawType);
  await drawer.clickGenerate();
  await drawer.waitForClose();
  return tournamentId;
}

const PLAYOFF_NAMES = ['Playoff 1', 'Playoff 2', 'Playoff 3', 'Playoff 4'];

const structureRoute = (tournamentId: string, eventId: string, drawId: string, structureId: string) =>
  `/#/tournament/${tournamentId}/event/${eventId}/draw/${drawId}/structure/${structureId}`;

test.describe('Journey 175 — round robin playoff Gold/Silver', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('Gold holds exactly the group winners and Silver exactly the runners-up', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    const tournamentId = await addRoundRobinWithPlayoffDraw(page, { playoffDrawType: 'SINGLE_ELIMINATION' });

    await expect
      .poll(async () => (await drawState(page)).drawType, { timeout: 10_000 })
      .toBe('ROUND_ROBIN_WITH_PLAYOFF');
    const { eventId, drawId, structures } = await drawState(page);
    const main = structures.find((s) => s.stage === 'MAIN' && s.stageSequence === 1);
    const playoffs = structures.filter((s) => s.stage === 'PLAY_OFF');
    expect(main?.groups).toBe(GROUPS);
    expect(playoffs.map((s) => s.structureName).sort()).toEqual(PLAYOFF_NAMES);
    expect(playoffs.every((s) => s.participantIds.length === 0)).toBe(true);
    const gold = playoffs.find((s) => s.structureName === GOLD)!;
    const autoPosition = page.locator(S.DRAW_CONTROL).getByRole('button', { name: AUTO_POSITION });

    // before the groups are complete the playoff cannot be positioned
    await page.goto(structureRoute(tournamentId, eventId, drawId, gold.structureId));
    await expect(autoPosition).toBeDisabled({ timeout: 10_000 });

    const results = await groupResults(page, main!.structureId);
    expect(results.length).toBe(GROUPS * ((GROUP_SIZE * (GROUP_SIZE - 1)) / 2));
    expect(results.every((r) => r.side1 && r.side2)).toBe(true);
    for (const r of results) {
      const scoreString = r.winningSide === 1 ? '6-2 6-3' : '2-6 3-6';
      await enterScore(page, { matchUpId: r.matchUpId, drawId: r.drawId, scoreString, winningSide: r.winningSide });
    }

    // the standings the factory computed agree with the strict order the scores imposed
    const standings = await groupStandings(page, main!.structureId);
    expect(standings.length).toBe(GROUPS);
    const byFinish: string[][] = Array.from({ length: GROUP_SIZE }, () => []);
    for (const group of standings) {
      const expectedOrder = group
        .map((p: any) => p.participantId)
        .sort()
        .reverse();
      for (const p of group) expect(p.groupOrder).toBe(expectedOrder.indexOf(p.participantId) + 1);
      expectedOrder.forEach((participantId: string, i: number) => byFinish[i].push(participantId));
    }

    // re-enter the playoff so its control bar reads the completed source
    await page.goto(structureRoute(tournamentId, eventId, drawId, main!.structureId));
    await page.goto(structureRoute(tournamentId, eventId, drawId, gold.structureId));
    await expect(autoPosition).toBeEnabled({ timeout: 10_000 });
    await autoPosition.click();

    const placed = async () => {
      const state = await drawState(page);
      return state.structures.filter((s) => s.stage === 'PLAY_OFF').map((s) => s.participantIds.length);
    };
    await expect.poll(placed, { timeout: 10_000 }).toEqual([GROUPS, GROUPS, GROUPS, GROUPS]);

    const after = (await drawState(page)).structures.filter((s) => s.stage === 'PLAY_OFF');
    const idsIn = (name: string) => [...(after.find((s) => s.structureName === name)?.participantIds ?? [])].sort();
    expect(idsIn(GOLD)).toEqual([...byFinish[0]].sort());
    expect(idsIn(SILVER)).toEqual([...byFinish[1]].sort());
    expect(idsIn('Playoff 3')).toEqual([...byFinish[2]].sort());
    expect(idsIn('Playoff 4')).toEqual([...byFinish[3]].sort());

    // no one in two playoffs, no one missing
    const everyone = after.flatMap((s) => s.participantIds);
    expect(new Set(everyone).size).toBe(ENTRIES);
    expect([...everyone].sort()).toEqual(byFinish.flat().sort());
  });

  // The drawer's DEFAULT "Playoff Draw Type" (a playoff per finishing position, Single Elimination) is covered by
  // journey 176 (TMX #1726, which fixed the select opening on its divider); this journey picks Single Elimination
  // explicitly so it tests the playoff placement alone.
});
