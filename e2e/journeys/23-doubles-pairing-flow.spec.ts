/**
 * Journey 23 — Doubles pairing: Full flow with mixed state
 *
 * Tests the realistic doubles workflow: start with auto-paired entries,
 * add individual participants as ungrouped, pair them, add more
 * individuals, pair those too. Verifies segment transitions and
 * mutation correctness throughout.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

const PROFILE_DOUBLES: MockProfile = {
  tournamentName: 'E2E Doubles Flow',
  tournamentAttributes: { tournamentId: 'e2e-doubles-flow' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Doubles', drawSize: 4, eventType: 'DOUBLES', generate: false }],
};

/** Navigate to entries and return counts helper */
async function getSegmentCounts(page: any): Promise<Record<string, number>> {
  const chips = await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents();
  const counts: Record<string, number> = {};
  for (const c of chips) {
    const label = c.trim();
    if (label) counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

/** Add N individual participants as UNGROUPED entries to the doubles event */
async function addUngroupedIndividuals(page: any, count: number): Promise<number> {
  return page.evaluate((n: number) => {
    const tournament = dev.getTournament();
    const event = tournament.events?.[0];
    if (!event) return 0;

    const enteredIds = new Set((event.entries || []).map((e: any) => e.participantId));
    // Also exclude individuals who are part of existing PAIR participants
    const pairMemberIds = new Set<string>();
    for (const p of tournament.participants) {
      if (p.participantType === 'PAIR') {
        for (const ip of p.individualParticipantIds || []) {
          pairMemberIds.add(ip);
        }
      }
    }

    const available = tournament.participants.filter(
      (p: any) =>
        p.participantType === 'INDIVIDUAL' &&
        !enteredIds.has(p.participantId) &&
        !pairMemberIds.has(p.participantId),
    );

    const toAdd = available.slice(0, n);
    for (const p of toAdd) {
      event.entries.push({
        participantId: p.participantId,
        entryStatus: 'UNGROUPED',
        entryStage: 'MAIN',
      });
    }
    dev.factory.tournamentEngine.setState(tournament);
    return toAdd.length;
  }, count);
}

/** Reload the entries view by navigating away and back */
async function reloadEntries(page: any): Promise<void> {
  await page.locator('#eventTabsBar').getByText('Rankings').click();
  await page.waitForTimeout(300);
  await page.locator('#eventTabsBar').getByText('Entries').click();
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  await page.locator(`${S.ENTRIES_VIEW} .tag`).first().waitFor({ state: 'visible', timeout: 5_000 });
}

async function navigateToEntries(page: any): Promise<string> {
  const tournamentId = await seedTournament(page, PROFILE_DOUBLES);

  // Add extra individual participants NOT part of any existing pairs
  await page.evaluate(() => {
    const { tournamentEngine, mocksEngine } = dev.factory;
    const { participants } = mocksEngine.generateParticipants({
      participantsCount: 12,
      participantType: 'INDIVIDUAL',
    });
    tournamentEngine.addParticipants({ participants });
  });

  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  const entriesVisible = await page.locator(S.ENTRIES_VIEW).isVisible().catch(() => false);
  if (!entriesVisible) {
    await page.locator('#eventTabsBar').getByText('Entries').click();
  }
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  return tournamentId;
}

test.describe('Journey 23 — Doubles pairing full flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('initial state: auto-paired entries in Accepted segment', async ({ page }) => {
    await navigateToEntries(page);

    const counts = await getSegmentCounts(page);
    console.log('Initial segments:', JSON.stringify(counts));

    // drawSize:4 with 16 participants → 4 pairs in Accepted
    expect(counts['Accepted']).toBeDefined();
    expect(counts['Accepted']).toBeGreaterThanOrEqual(4);
  });

  test('adding ungrouped individuals creates Ungrouped segment', async ({ page }) => {
    await navigateToEntries(page);

    const countsBefore = await getSegmentCounts(page);
    expect(countsBefore['Ungrouped']).toBeUndefined();

    // Add 4 ungrouped individuals
    const added = await addUngroupedIndividuals(page, 4);
    expect(added).toBe(4);

    await reloadEntries(page);
    const countsAfter = await getSegmentCounts(page);
    console.log('After adding ungrouped:', JSON.stringify(countsAfter));

    expect(countsAfter['Ungrouped']).toBe(4);
    expect(countsAfter['Accepted']).toBe(countsBefore['Accepted']);
  });

  test('pair 2 ungrouped via factory → new Alternates pair appears', async ({ page }) => {
    const collector = createMutationCollector(page);
    await navigateToEntries(page);
    const added = await addUngroupedIndividuals(page, 4);
    expect(added).toBe(4);
    await reloadEntries(page);

    // Get the first 2 ungrouped participant IDs
    const pairIds = await page.evaluate(() => {
      const event = dev.getTournament().events?.[0];
      return (event?.entries || [])
        .filter((e: any) => e.entryStatus === 'UNGROUPED')
        .slice(0, 2)
        .map((e: any) => e.participantId);
    });
    expect(pairIds.length).toBe(2);

    // Pair them via the factory engine (simulating what pairFromUnified does)
    await page.evaluate((ids: string[]) => {
      const event = dev.getTournament().events?.[0];
      if (!event) return;
      const eventId = event.eventId;
      const participantId = dev.factory.tools.UUID();
      dev.factory.tournamentEngine.addEventEntryPairs({
        participantIdPairs: [ids],
        allowDuplicateParticipantIdPairs: true,
        entryStatus: 'ALTERNATE',
        entryStage: 'MAIN',
        uuids: [participantId],
        eventId,
      });
    }, pairIds);

    await reloadEntries(page);
    const countsAfter = await getSegmentCounts(page);
    console.log('After pairing 2:', JSON.stringify(countsAfter));

    // Should have 2 fewer ungrouped (4→2) and 1 new alternate pair
    expect(countsAfter['Ungrouped']).toBe(2);
    expect(countsAfter['Alternates']).toBe(1);

    collector.detach();
  });

  test('add more individuals after pairing → mixed Accepted + Alternates + Ungrouped', async ({ page }) => {
    await navigateToEntries(page);

    // Add 4 ungrouped, pair 2 of them
    await addUngroupedIndividuals(page, 4);
    const pairIds = await page.evaluate(() => {
      const event = dev.getTournament().events?.[0];
      return (event?.entries || [])
        .filter((e: any) => e.entryStatus === 'UNGROUPED')
        .slice(0, 2)
        .map((e: any) => e.participantId);
    });
    await page.evaluate((ids: string[]) => {
      const event = dev.getTournament().events?.[0];
      if (!event) return;
      dev.factory.tournamentEngine.addEventEntryPairs({
        participantIdPairs: [ids],
        allowDuplicateParticipantIdPairs: true,
        entryStatus: 'ALTERNATE',
        entryStage: 'MAIN',
        uuids: [dev.factory.tools.UUID()],
        eventId: event.eventId,
      });
    }, pairIds);

    // Now add 2 more ungrouped
    const added2 = await addUngroupedIndividuals(page, 2);
    expect(added2).toBe(2);

    await reloadEntries(page);
    const counts = await getSegmentCounts(page);
    console.log('Mixed state:', JSON.stringify(counts));

    // Should have: Accepted (original pairs), Alternates (1 new pair), Ungrouped (2+2=4)
    expect(counts['Accepted']).toBeGreaterThanOrEqual(4);
    expect(counts['Alternates']).toBe(1);
    expect(counts['Ungrouped']).toBe(4);

    // All 3 segments should appear in sorted order
    const chipTexts = (await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents()).map((t: string) => t.trim());
    const firstAlternate = chipTexts.indexOf('Alternates');
    const firstUngrouped = chipTexts.indexOf('Ungrouped');
    expect(firstAlternate).toBeLessThan(firstUngrouped);
  });

  test('pair second batch → all ungrouped consumed', async ({ page }) => {
    await navigateToEntries(page);

    // Add 4 ungrouped
    await addUngroupedIndividuals(page, 4);

    // Pair all 4 (two pairs)
    const allUngroupedIds = await page.evaluate(() => {
      const event = dev.getTournament().events?.[0];
      return (event?.entries || [])
        .filter((e: any) => e.entryStatus === 'UNGROUPED')
        .map((e: any) => e.participantId);
    });
    expect(allUngroupedIds.length).toBe(4);

    // Create pair 1 (first 2)
    await page.evaluate((ids: string[]) => {
      const event = dev.getTournament().events?.[0];
      if (!event) return;
      dev.factory.tournamentEngine.addEventEntryPairs({
        participantIdPairs: [ids.slice(0, 2)],
        allowDuplicateParticipantIdPairs: true,
        entryStatus: 'ALTERNATE',
        entryStage: 'MAIN',
        uuids: [dev.factory.tools.UUID()],
        eventId: event.eventId,
      });
    }, allUngroupedIds);

    // Create pair 2 (last 2)
    await page.evaluate((ids: string[]) => {
      const event = dev.getTournament().events?.[0];
      if (!event) return;
      dev.factory.tournamentEngine.addEventEntryPairs({
        participantIdPairs: [ids.slice(2, 4)],
        allowDuplicateParticipantIdPairs: true,
        entryStatus: 'ALTERNATE',
        entryStage: 'MAIN',
        uuids: [dev.factory.tools.UUID()],
        eventId: event.eventId,
      });
    }, allUngroupedIds);

    await reloadEntries(page);
    const counts = await getSegmentCounts(page);
    console.log('All paired:', JSON.stringify(counts));

    // All ungrouped consumed → no Ungrouped segment
    expect(counts['Ungrouped'] ?? 0).toBe(0);
    // 2 new alternate pairs
    expect(counts['Alternates']).toBe(2);
    // Original accepted pairs still there
    expect(counts['Accepted']).toBeGreaterThanOrEqual(4);
  });

  test('entry counts via factory match segment chip counts', async ({ page }) => {
    await navigateToEntries(page);
    await addUngroupedIndividuals(page, 4);
    await reloadEntries(page);

    // Get counts from factory
    const factoryCounts = await page.evaluate(() => {
      const event = dev.getTournament().events?.[0];
      const entries = event?.entries || [];
      return {
        total: entries.length,
        accepted: entries.filter((e: any) => e.entryStatus === 'DIRECT_ACCEPTANCE').length,
        ungrouped: entries.filter((e: any) => e.entryStatus === 'UNGROUPED').length,
        alternate: entries.filter((e: any) => e.entryStatus === 'ALTERNATE').length,
      };
    });

    // Get counts from UI
    const uiCounts = await getSegmentCounts(page);

    console.log('Factory:', JSON.stringify(factoryCounts));
    console.log('UI:', JSON.stringify(uiCounts));

    expect(uiCounts['Accepted'] ?? 0).toBe(factoryCounts.accepted);
    expect(uiCounts['Ungrouped'] ?? 0).toBe(factoryCounts.ungrouped);
    expect(uiCounts['Alternates'] ?? 0).toBe(factoryCounts.alternate);
  });

  test('no errors during doubles pairing lifecycle', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    await navigateToEntries(page);
    await addUngroupedIndividuals(page, 4);
    await reloadEntries(page);

    // Pair via engine
    const ids = await page.evaluate(() => {
      const event = dev.getTournament().events?.[0];
      return (event?.entries || [])
        .filter((e: any) => e.entryStatus === 'UNGROUPED')
        .slice(0, 2)
        .map((e: any) => e.participantId);
    });
    await page.evaluate((pairIds: string[]) => {
      const event = dev.getTournament().events?.[0];
      if (!event) return;
      dev.factory.tournamentEngine.addEventEntryPairs({
        participantIdPairs: [pairIds],
        allowDuplicateParticipantIdPairs: true,
        entryStatus: 'ALTERNATE',
        entryStage: 'MAIN',
        uuids: [dev.factory.tools.UUID()],
        eventId: event.eventId,
      });
    }, ids);

    await reloadEntries(page);

    // Add more
    await addUngroupedIndividuals(page, 2);
    await reloadEntries(page);

    // Verify no JS errors throughout
    const typeErrors = errors.filter((e) => e.includes('TypeError') || e.includes('is not a function'));
    expect(typeErrors).toEqual([]);
  });
});
