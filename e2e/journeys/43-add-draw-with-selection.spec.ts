/**
 * Journey 43 — Add draw with selection-aware drawEntries
 *
 * When rows are selected in the unified entries panel at the moment "Add
 * draw" is clicked, the new draw's `drawEntries` are derived from those
 * participantIds — cross-stage allowed — rather than the legacy
 * entry-status-filtered fallback.
 *
 * Backed by factory `generateNewDrawDefinition.addEntries` which now places
 * stage-matching entries in the positioning step and records cross-stage
 * entries on `drawDefinition.entries` for later Generate-Qualifying use.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady, ensureDrawsTableMode } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';

const PROFILE_MIXED_ENTRIES: MockProfile = {
  tournamentName: 'E2E Selection-aware Add Draw',
  tournamentAttributes: { tournamentId: 'e2e-add-draw-selection' },
  participantsProfile: { scaledParticipantsCount: 80 },
  // No drawProfiles — the event has only entries, no draw yet.
  eventProfiles: [
    {
      eventName: 'Singles',
      participantsCount: 16,
    },
  ] as any,
};

/** Add `count` qualifying-stage entries directly via the engine so the
 *  event has both MAIN and QUALIFYING entries before the user clicks
 *  "Add draw" with a selection. */
async function addQualifyingEntries(page: any, eventId: string, count: number): Promise<string[]> {
  return page.evaluate(
    ({ eventId, count }: { eventId: string; count: number }) => {
      const engine = (dev as any).factory.tournamentEngine;
      const { participants } = engine.getParticipants();
      const { event } = engine.getEvent({ eventId });
      const taken = new Set((event.entries ?? []).map((e: any) => e.participantId));
      const ids = participants
        .map((p: any) => p.participantId)
        .filter((id: string) => !taken.has(id))
        .slice(0, count);
      engine.addEventEntries({ participantIds: ids, entryStage: 'QUALIFYING', eventId });
      (dev as any).load((dev as any).getTournament());
      return ids as string[];
    },
    { eventId, count },
  );
}

async function getEventId(page: any): Promise<string> {
  return page.evaluate(() => {
    const tr = (dev as any).getTournament();
    return tr.events[0].eventId as string;
  });
}

/** Invoke submitDrawParams' upstream — addDraw with explicit
 *  selectedParticipantIds — directly through the dev bridge. We can't easily
 *  drive Tabulator selection through the UI in a single e2e run, but the
 *  contract under test is: "selectedParticipantIds, when provided, become
 *  the new draw's drawEntries". The unit test in submitDrawParams covers
 *  the wiring, this one covers the end-to-end factory contract through
 *  generateDrawDefinition. */
async function submitAddDrawWithSelection(
  page: any,
  eventId: string,
  selectedParticipantIds: string[],
): Promise<any> {
  return page.evaluate(
    ({ eventId, selectedParticipantIds }: { eventId: string; selectedParticipantIds: string[] }) => {
      const engine = (dev as any).factory.tournamentEngine;
      const { event } = engine.getEvent({ eventId });
      const selectedSet = new Set(selectedParticipantIds);
      const drawEntries = event.entries.filter((e: any) => selectedSet.has(e.participantId));
      return engine.generateDrawDefinition({
        drawEntries,
        drawSize: 32,
        drawType: 'SINGLE_ELIMINATION',
        qualifiersCount: 16,
        qualifyingPlaceholder: true,
        eventId,
      });
    },
    { eventId, selectedParticipantIds },
  );
}

test.describe('Journey 43 — Add draw uses panel selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test('cross-stage selection is preserved on the draw', async ({ page }) => {
    await seedTournament(page, PROFILE_MIXED_ENTRIES);
    const eventId = await getEventId(page);
    const qualifyingIds = await addQualifyingEntries(page, eventId, 48);

    // Selection mirrors a user lassoing every entry — both main and qualifying.
    const allEntryIds = await page.evaluate((eventId: string) => {
      const engine = (dev as any).factory.tournamentEngine;
      const { event } = engine.getEvent({ eventId });
      return (event.entries ?? []).map((e: any) => e.participantId) as string[];
    }, eventId);

    const result = await submitAddDrawWithSelection(page, eventId, allEntryIds);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const ddEntries = result.drawDefinition?.entries ?? [];
    const mainOnDraw = ddEntries.filter((e: any) => !e.entryStage || e.entryStage === 'MAIN');
    const qualifyingOnDraw = ddEntries.filter((e: any) => e.entryStage === 'QUALIFYING');

    // Every selected qualifying participant rode along on drawDefinition.entries.
    expect(qualifyingOnDraw.length).toBe(qualifyingIds.length);
    // The 16 main entries were placed in the main structure.
    const main = result.drawDefinition.structures.find((s: any) => s.stage === 'MAIN');
    expect(main.positionAssignments.filter((p: any) => p.participantId).length).toBe(mainOnDraw.length);
    // Qualifier slots were still reserved (qualifiersCount + qualifyingPlaceholder).
    expect(main.positionAssignments.filter((p: any) => p.qualifier).length).toBe(16);
  });
});
