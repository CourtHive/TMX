/**
 * Journey 44 — Add to draw / Remove from draw on selection
 *
 * D: Selecting event entries on the all-entries view exposes "Add to draw";
 * selecting draw entries on a specific-draw view exposes "Remove from draw".
 * The factory's REMOVE_DRAW_ENTRIES already refuses to remove a participant
 * with an assigned drawPosition, so the gate just hides the option for
 * already-placed participants (no need to re-implement the check).
 *
 * This journey exercises the mutation contract through the dev bridge —
 * the overlay button wiring is unit-tested at the TMX layer; this proves
 * end-to-end that:
 *   - ADD_DRAW_ENTRIES with the right stage adds to drawDefinition.entries
 *   - REMOVE_DRAW_ENTRIES removes unplaced participants from the draw
 *     and rejects placed ones.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady, ensureDrawsTableMode } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';

const PROFILE_DRAW_WITH_ENTRIES: MockProfile = {
  tournamentName: 'E2E Add/Remove Draw Entries',
  tournamentAttributes: { tournamentId: 'e2e-add-remove-draw-entries' },
  participantsProfile: { scaledParticipantsCount: 80 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 32,
      drawType: 'SINGLE_ELIMINATION',
      qualifyingPlaceholder: true,
      qualifiersCount: 8,
      participantsCount: 24,
      automated: false,
    },
  ],
};

async function getFirstDrawId(page: any): Promise<string> {
  return page.evaluate(() => {
    const tr = (dev as any).getTournament();
    return tr.events[0].drawDefinitions[0].drawId as string;
  });
}

async function getEventId(page: any): Promise<string> {
  return page.evaluate(() => {
    const tr = (dev as any).getTournament();
    return tr.events[0].eventId as string;
  });
}

test.describe('Journey 44 — Add to draw / Remove from draw on selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test('add qualifying-stage event entries to an existing draw', async ({ page }) => {
    await seedTournament(page, PROFILE_DRAW_WITH_ENTRIES);
    const eventId = await getEventId(page);
    const drawId = await getFirstDrawId(page);

    // Find event entries that are NOT in the draw (cross-stage allowed).
    const addedIds = await page.evaluate(
      ({ eventId, drawId }: { eventId: string; drawId: string }) => {
        const engine = (dev as any).factory.tournamentEngine;
        const event = engine.q.event({ eventId });
        const dd = event.drawDefinitions.find((d: any) => d.drawId === drawId);
        const inDraw = new Set((dd.entries ?? []).map((e: any) => e.participantId));
        const candidates = (event.entries ?? [])
          .filter((e: any) => !inDraw.has(e.participantId))
          .map((e: any) => e.participantId)
          .slice(0, 8);
        if (!candidates.length) throw new Error('no event entries outside the draw');
        return candidates as string[];
      },
      { eventId, drawId },
    );
    expect(addedIds.length).toBeGreaterThan(0);

    // Replay what the "Add to draw" overlay submits.
    const addResult = await page.evaluate(
      ({ eventId, drawId, participantIds }: { eventId: string; drawId: string; participantIds: string[] }) => {
        const engine = (dev as any).factory.tournamentEngine;
        return engine.addDrawEntries({
          entryStatus: 'DIRECT_ACCEPTANCE',
          entryStage: 'QUALIFYING',
          ignoreStageSpace: true,
          participantIds,
          eventId,
          drawId,
        });
      },
      { eventId, drawId, participantIds: addedIds },
    );
    expect(addResult.error).toBeUndefined();
    expect(addResult.success).toBe(true);

    const ddState = await page.evaluate(
      ({ drawId }: { drawId: string }) => {
        const tr = (dev as any).getTournament();
        const dd = tr.events[0].drawDefinitions.find((d: any) => d.drawId === drawId);
        return (dd.entries ?? []).filter((e: any) => e.entryStage === 'QUALIFYING').map((e: any) => e.participantId);
      },
      { drawId },
    );
    for (const id of addedIds) expect(ddState).toContain(id);
  });

  test('remove unplaced participants from a draw', async ({ page }) => {
    await seedTournament(page, PROFILE_DRAW_WITH_ENTRIES);
    const eventId = await getEventId(page);
    const drawId = await getFirstDrawId(page);

    // Pick a participant that is on the draw but NOT placed.
    const removable = await page.evaluate(
      ({ eventId, drawId }: { eventId: string; drawId: string }) => {
        const engine = (dev as any).factory.tournamentEngine;
        const tr = (dev as any).getTournament();
        const event = tr.events.find((e: any) => e.eventId === eventId);
        const dd = event.drawDefinitions.find((d: any) => d.drawId === drawId);
        const placed = new Set(
          dd.structures
            .flatMap((s: any) => s.positionAssignments ?? [])
            .map((p: any) => p?.participantId)
            .filter(Boolean),
        );
        const unplaced = (dd.entries ?? [])
          .filter((e: any) => !placed.has(e.participantId))
          .map((e: any) => e.participantId);
        return unplaced[0];
      },
      { eventId, drawId },
    );
    expect(removable).toBeDefined();

    const removeResult = await page.evaluate(
      ({ eventId, drawId, participantIds }: { eventId: string; drawId: string; participantIds: string[] }) => {
        const engine = (dev as any).factory.tournamentEngine;
        return engine.removeDrawEntries({ participantIds, eventId, drawId });
      },
      { eventId, drawId, participantIds: [removable] },
    );
    expect(removeResult.error).toBeUndefined();
    expect(removeResult.success).toBe(true);

    const stillThere = await page.evaluate(
      ({ drawId, participantId }: { drawId: string; participantId: string }) => {
        const tr = (dev as any).getTournament();
        const dd = tr.events[0].drawDefinitions.find((d: any) => d.drawId === drawId);
        return (dd.entries ?? []).some((e: any) => e.participantId === participantId);
      },
      { drawId, participantId: removable },
    );
    expect(stillThere).toBe(false);
  });

  test('refuses to remove placed participants', async ({ page }) => {
    // Use a different seed where the draw IS automatically positioned
    // so we have a placed participant to attempt removing.
    const profile: MockProfile = {
      ...PROFILE_DRAW_WITH_ENTRIES,
      tournamentAttributes: { tournamentId: 'e2e-remove-placed' },
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
    await seedTournament(page, profile);
    const eventId = await getEventId(page);
    const drawId = await getFirstDrawId(page);

    const placedId = await page.evaluate(
      ({ drawId }: { drawId: string }) => {
        const tr = (dev as any).getTournament();
        const dd = tr.events[0].drawDefinitions.find((d: any) => d.drawId === drawId);
        const main = dd.structures.find((s: any) => s.stage === 'MAIN');
        return main.positionAssignments.find((p: any) => p.participantId)?.participantId;
      },
      { drawId },
    );
    expect(placedId).toBeDefined();

    const result = await page.evaluate(
      ({ eventId, drawId, participantIds }: { eventId: string; drawId: string; participantIds: string[] }) => {
        const engine = (dev as any).factory.tournamentEngine;
        return engine.removeDrawEntries({ participantIds, eventId, drawId });
      },
      { eventId, drawId, participantIds: [placedId] },
    );
    expect(result.error).toBeDefined();
  });
});
