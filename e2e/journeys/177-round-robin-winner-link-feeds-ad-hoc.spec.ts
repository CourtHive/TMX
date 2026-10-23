/**
 * Journey 177 — a round robin link feeds an AD_HOC playoff by finishing position, whatever its label
 *
 * A link out of a round robin is directed by its `finishingPositions` whether it is labelled POSITION or WINNER, and a
 * `source.roundNumber` on it decides nothing (CA ruling, 2026-10-23). Records converted from classic TMX carry WINNER.
 * The factory makes a round robin whose group winners feed an AD_HOC "Gold" playoff (a POSITION link). The journey
 * relabels that link into each of the four shapes before loading the record, then generates Gold's first round through
 * the "Generate round" button, the add-round modal and the player selection.
 *
 * The selection is preloaded from the linked participants, so Gold's first round must hold exactly the group winners.
 * A finder that reads the link by its label finds no link for the WINNER shapes: the selection opens empty and
 * no round is made. Asserted on participantIds and group finishing order, never names.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';

const ENTRIES = 16;
const GROUP_SIZE = 4;
const GROUPS = ENTRIES / GROUP_SIZE;
const GOLD = 'Gold';

type Shape = { linkType: 'POSITION' | 'WINNER'; roundNumber?: number };

const SHAPES: Shape[] = [
  { linkType: 'POSITION' },
  { linkType: 'POSITION', roundNumber: GROUP_SIZE - 1 },
  { linkType: 'WINNER' },
  { linkType: 'WINNER', roundNumber: GROUP_SIZE - 1 },
];

type Seeded = {
  tournamentId: string;
  eventId: string;
  drawId: string;
  goldId: string;
  link: { linkType: string; source: any };
  groupWinners: string[][];
};

/** Generate a completed round robin feeding an empty AD_HOC Gold playoff, relabel its link to `shape`, then load it. */
async function seedRoundRobinFeedingAdHoc(page: Page, shape: Shape): Promise<Seeded> {
  return page.evaluate(
    async ({ shape, entries, groupSize, gold }) => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        tournamentAttributes: { tournamentId: 'e2e-rr-winner-link-ad-hoc' },
        participantsProfile: { scaledParticipantsCount: entries },
        drawProfiles: [
          {
            drawSize: entries,
            drawType: 'ROUND_ROBIN_WITH_PLAYOFF',
            structureOptions: {
              groupSize,
              playoffGroups: [{ finishingPositions: [1], structureName: gold, drawType: 'AD_HOC' }],
            },
          },
        ],
        completeAllMatchUps: true,
      });
      const event = tournamentRecord.events[0];
      const draw = event.drawDefinitions[0];
      const goldStructure = draw.structures.find((s: any) => s.structureName === gold);
      const container = draw.structures.find((s: any) => s.structures?.length);
      const link = draw.links.find((l: any) => l.target.structureId === goldStructure.structureId);

      link.linkType = shape.linkType;
      if (shape.roundNumber) link.source.roundNumber = shape.roundNumber;
      else delete link.source.roundNumber;

      // the tally sits on the assignment (native writeMode) or in its `tally` extension (legacy records)
      const groupOrder = (pa: any) =>
        pa.tally?.groupOrder ?? pa.extensions?.find((x: any) => x.name === 'tally')?.value?.groupOrder;
      const groupWinners = container.structures.map((group: any) =>
        group.positionAssignments.filter((pa: any) => groupOrder(pa) === 1).map((pa: any) => pa.participantId),
      );

      await dev.load(tournamentRecord);
      return {
        tournamentId: tournamentRecord.tournamentId,
        eventId: event.eventId,
        drawId: draw.drawId,
        goldId: goldStructure.structureId,
        link: { linkType: link.linkType, source: link.source },
        groupWinners,
      };
    },
    { shape, entries: ENTRIES, groupSize: GROUP_SIZE, gold: GOLD },
  );
}

/** The participantIds in Gold's matchUps, as the page holds them. */
async function goldParticipantIds(page: Page, goldId: string): Promise<string[]> {
  return page.evaluate((structureId) => {
    const draw = dev.getTournament().events[0].drawDefinitions[0];
    const gold = draw.structures.find((s: any) => s.structureId === structureId);
    return (gold?.matchUps ?? []).flatMap((m: any) => (m.sides ?? []).map((side: any) => side.participantId));
  }, goldId);
}

const structureRoute = ({ tournamentId, eventId, drawId, goldId }: Seeded) =>
  `/#/tournament/${tournamentId}/event/${eventId}/draw/${drawId}/structure/${goldId}`;

test.describe('Journey 177 — round robin link feeds an AD_HOC playoff, whatever its label', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  for (const shape of SHAPES) {
    const name = shape.roundNumber ? `${shape.linkType} + roundNumber ${shape.roundNumber}` : shape.linkType;
    test(`Gold's first round holds exactly the group winners: ${name}`, async ({ page }) => {
      const seeded = await seedRoundRobinFeedingAdHoc(page, shape);

      // the record carries the shape under test, and every group has exactly one winner
      expect(seeded.link.linkType).toBe(shape.linkType);
      expect(seeded.link.source.roundNumber).toBe(shape.roundNumber);
      expect(seeded.link.source.finishingPositions).toEqual([1]);
      expect(seeded.groupWinners).toHaveLength(GROUPS);
      expect(seeded.groupWinners.every((winners) => winners.length === 1)).toBe(true);
      const winners = seeded.groupWinners.flat().sort();

      const tournamentPage = new TournamentPage(page);
      await tournamentPage.goto(seeded.tournamentId);
      await tournamentPage.navigateToEvents();
      await page.goto(structureRoute(seeded));
      await page.getByRole('button', { name: 'Generate round', exact: true }).click();

      const addRound = page.locator('.chc-modal-dialog').filter({ hasText: 'Add round' });
      await addRound.getByRole('button', { name: 'Add round', exact: true }).click();

      const selection = page.locator('.chc-modal-dialog').filter({ hasText: 'Confirm player selection' });
      await expect(selection).toBeVisible();
      await selection.getByRole('button', { name: 'Select', exact: true }).click();

      await expect.poll(async () => (await goldParticipantIds(page, seeded.goldId)).sort()).toEqual(winners);
      expect(await goldParticipantIds(page, seeded.goldId)).toHaveLength(GROUPS);
    });
  }
});
