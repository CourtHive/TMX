/**
 * Journey 46 — Cross-stage selection shouldn't inflate the MAIN drawSize check
 *
 * Scenario the user reported:
 *   - Event has 16 MAIN entries + 32 QUALIFYING entries (48 total)
 *   - User selects every event entry, clicks "Add draw"
 *   - Picks drawSize 32 with 16 qualifier slots
 *   - Today: TMX rejected with "Draw size (32) must be at least 64
 *             (48 entries + 16 qualifiers)" because the validation counted
 *             all selected entries as MAIN.
 *
 * The MAIN draw only seats main-stage entries; cross-stage QUALIFYING entries
 * ride along on drawDefinition.entries (no positioning, see
 * generateNewDrawDefinition.addEntries). Validation must filter to stage.
 *
 * This is a unit-level e2e against the live factory through the dev bridge.
 * We seed the user's exact entry shape, replay the addDraw → factory call,
 * and assert success.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady, ensureDrawsTableMode } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';

const PROFILE_16_MAIN_32_QUALIFYING: MockProfile = {
  tournamentName: 'E2E Cross-stage Sizing',
  tournamentAttributes: { tournamentId: 'e2e-cross-stage-sizing' },
  participantsProfile: { participantsCount: 80 } as any,
  eventProfiles: [{ eventName: 'Singles', participantsCount: 0 }] as any,
};

async function seedEntries(page: any, eventId: string): Promise<string[]> {
  return page.evaluate(
    ({ eventId }: { eventId: string }) => {
      const engine = (dev as any).factory.tournamentEngine;
      const { participants } = engine.getParticipants();
      const ids = participants.map((p: any) => p.participantId);
      const mainIds = ids.slice(0, 16);
      const qualifyingIds = ids.slice(16, 48);
      engine.addEventEntries({ participantIds: mainIds, eventId });
      engine.addEventEntries({ participantIds: qualifyingIds, entryStage: 'QUALIFYING', eventId });
      return [...mainIds, ...qualifyingIds] as string[];
    },
    { eventId },
  );
}

async function getEventId(page: any): Promise<string> {
  return page.evaluate(() => (dev as any).getTournament().events[0].eventId as string);
}

test.describe('Journey 46 — Cross-stage drawSize sizing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test('drawSize 32 + 16 qualifiers accepts a 16-main / 32-qualifying selection', async ({ page }) => {
    await seedTournament(page, PROFILE_16_MAIN_32_QUALIFYING);
    const eventId = await getEventId(page);
    const allSelected = await seedEntries(page, eventId);
    expect(allSelected.length).toBe(48);

    // Mirror what TMX's submitDrawParams now builds when the user selected
    // both stages and picked drawSize 32 + qualifiersCount 16. The factory
    // call should succeed; positioning only consumes MAIN entries, qualifying
    // entries ride along on drawDefinition.entries.
    const result = await page.evaluate(
      ({ eventId, allSelected }: { eventId: string; allSelected: string[] }) => {
        const engine = (dev as any).factory.tournamentEngine;
        const event = engine.q.event({ eventId });
        const selectedSet = new Set(allSelected);
        const drawEntries = event.entries.filter((e: any) => selectedSet.has(e.participantId));
        return engine.generateDrawDefinition({
          drawEntries,
          drawSize: 32,
          drawType: 'SINGLE_ELIMINATION',
          qualifiersCount: 16,
          qualifyingPlaceholder: true,
          ignoreStageSpace: true,
          eventId,
        });
      },
      { eventId, allSelected },
    );
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const dd = result.drawDefinition;
    const main = dd.structures.find((s: any) => s.stage === 'MAIN');
    const placed = main.positionAssignments.filter((p: any) => p.participantId).length;
    const qualifierSlots = main.positionAssignments.filter((p: any) => p.qualifier).length;
    expect(placed).toBe(16);
    expect(qualifierSlots).toBe(16);

    const ddQualifyingEntries = (dd.entries ?? []).filter((e: any) => e.entryStage === 'QUALIFYING');
    expect(ddQualifyingEntries.length).toBe(32);
  });
});
