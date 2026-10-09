/**
 * Journey 148 — a FEED_IN (staggered entry) QUALIFYING structure, started from the Add draw form
 *
 * CA (2026-10-09): "If I have 12 entries at stage qualifying I should be able to create a drawSize of 12, for
 * instance, which has 8 in the first round of qualifying and 4 fed participants in the second round of qualifying,
 * producing 4 qualifiers; but if I had a qualifying draw of size 13 then it would only be possible to produce 1
 * qualiier because the final round of qualifying has to be at least the last fed round."
 *
 * The qualifying draw types were SINGLE_ELIMINATION and ROUND_ROBIN only. "Feed in (staggered entry)" is now offered
 * for qualifying, and the qualifier count moves to one the size can produce (13 positions: 1).
 */
import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { test, expect, type Page } from '@playwright/test';

const QUALIFYING_POSITIONS = 'Qualifying positions';

/** `qualifyingCount` QUALIFYING entries and 8 MAIN entries; no draw yet. */
async function seedEvent(page: Page, qualifyingCount: number): Promise<string> {
  return page.evaluate(
    async ({ qualifyingCount }) => {
      await dev.tmx2db.initDB();
      const factory: any = dev.factory;
      const engine = factory.tournamentEngine;
      const { tournamentRecord } = factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId: 'e2e-feed-in-qualifying' },
        participantsProfile: { participantsCount: qualifyingCount + 8 },
        tournamentName: 'E2E Feed In Qualifying',
        setState: true,
        nonRandom: 1,
      });
      const eventId = engine.addEvent({ event: { eventName: 'Singles', eventType: 'SINGLES' } }).event.eventId;
      const participantIds = engine.getParticipants().participants.map((p: any) => p.participantId);
      engine.addEventEntries({
        participantIds: participantIds.slice(0, qualifyingCount),
        entryStage: 'QUALIFYING',
        eventId,
      });
      engine.addEventEntries({ participantIds: participantIds.slice(qualifyingCount), eventId });
      await dev.load({ tournamentRecord: engine.getTournament().tournamentRecord });
      return tournamentRecord.tournamentId;
    },
    { qualifyingCount },
  );
}

async function openQualifyingFirst(page: Page, tournamentId: string): Promise<DrawFormDrawer> {
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();
  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  await drawer.toggleCheckbox('qualifyingFirst');
  await drawer.expectFieldVisible(QUALIFYING_POSITIONS);
  return drawer;
}

const qualifyingStructure = (page: Page) =>
  page.evaluate(() => {
    const draw = dev.getTournament().events[0].drawDefinitions?.[0];
    const qualifying = draw?.structures.find((s: any) => s.stage === 'QUALIFYING');
    if (!qualifying) return undefined;
    const rounds: Record<number, number> = {};
    qualifying.matchUps.forEach((m: any) => (rounds[m.roundNumber] = (rounds[m.roundNumber] ?? 0) + 1));
    const assignments = qualifying.positionAssignments ?? [];
    return {
      positions: assignments.length,
      participants: assignments.filter((pa: any) => pa.participantId).length,
      byes: assignments.filter((pa: any) => pa.bye).length,
      rounds,
    };
  });

test.describe('Journey 148 — FEED_IN qualifying', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test('12 qualifying entries: 8 in round 1 and 4 fed into round 2 produce 4 qualifiers', async ({ page }) => {
    const drawer = await openQualifyingFirst(page, await seedEvent(page, 12));

    expect(await drawer.getSelectOptionValues('Draw Type')).toContain('FEED_IN');
    await drawer.selectDrawType('FEED_IN');
    await expect(drawer.fieldInput('Draw size')).toHaveValue('12');
    await expect(drawer.fieldInput(QUALIFYING_POSITIONS)).toHaveValue('4');

    await drawer.clickGenerate();
    await drawer.waitForClose();

    await expect
      .poll(() => qualifyingStructure(page), { timeout: 10_000 })
      .toEqual({ positions: 12, participants: 12, byes: 0, rounds: { 1: 4, 2: 4 } });
  });

  test('13 qualifying entries can produce only 1 qualifier: the count moves to 1', async ({ page }) => {
    const drawer = await openQualifyingFirst(page, await seedEvent(page, 13));

    await drawer.selectDrawType('FEED_IN');
    await expect(drawer.fieldInput('Draw size')).toHaveValue('13');
    // the default of 4 is not possible from 13: the final round must be at or after the last fed round
    await expect(drawer.fieldInput(QUALIFYING_POSITIONS)).toHaveValue('1');

    await drawer.clickGenerate();
    await drawer.waitForClose();

    await expect
      .poll(() => qualifyingStructure(page), { timeout: 10_000 })
      .toEqual({ positions: 13, participants: 13, byes: 0, rounds: { 1: 4, 2: 4, 3: 2, 4: 1, 5: 1 } });
  });
});
