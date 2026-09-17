/**
 * Journey 123 — Destroy-and-re-pair round trip on a doubles draw
 *
 * Regression. `pairFromUnified` used to send ADD_EVENT_ENTRY_PAIRS without a `drawId`, so the
 * factory's paramsMiddleware never resolved a `drawDefinition` and `addEventEntries` skipped
 * `addDrawEntries`. The new PAIR landed only on `event.entries` (as a hardcoded ALTERNATE), while
 * the same call's `removeUngroupedParticipantIdsHelper` evicted the two individuals from *every*
 * drawDefinition via `removeEventEntries`. Destroying a pair and re-pairing the individuals
 * therefore shrank the draw field by two with nothing replacing them — visible on an AD_HOC
 * doubles draw, where loose individuals are a legitimate intermediate state.
 *
 * The round trip must be conservative: destroy → re-pair returns the draw to the entry count it
 * started with, with the new PAIR present on `drawDefinition.entries`.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

const PROFILE_ADHOC_DOUBLES: MockProfile = {
  tournamentName: 'E2E Doubles Round Trip',
  tournamentAttributes: { tournamentId: 'e2e-doubles-round-trip' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [
    {
      eventName: 'AdHoc Doubles',
      eventType: 'DOUBLES',
      drawType: 'AD_HOC',
      drawSize: 8,
      automated: false,
    },
  ],
};

type DrawState = {
  eventId: string;
  drawId: string;
  /** drawDefinition.entries, hydrated so the test can tell PAIRs apart and find rows by name. */
  entries: { participantId: string; entryStatus: string; participantType?: string; rowName?: string }[];
};

async function readDrawState(page: any): Promise<DrawState> {
  return page.evaluate(() => {
    const engine = (dev as any).factory.tournamentEngine;
    const tournamentRecord = (dev as any).getTournament();
    const event = tournamentRecord.events[0];
    const drawDefinition = event.drawDefinitions[0];
    const { participants } = engine.getParticipants();
    const byId = new Map(participants.map((p: any) => [p.participantId, p]));
    return {
      eventId: event.eventId,
      drawId: drawDefinition.drawId,
      entries: (drawDefinition.entries ?? []).map((entry: any) => {
        const participant = byId.get(entry.participantId) as any;
        // The unified table renders a PAIR as its two individuals' names, never the pair name —
        // so a PAIR row is addressed by the name of the individual it contains.
        const individual = byId.get(participant?.individualParticipantIds?.[0]) as any;
        return {
          participantId: entry.participantId,
          entryStatus: entry.entryStatus,
          participantType: participant?.participantType,
          rowName: individual?.participantName ?? participant?.participantName,
        };
      }),
    };
  });
}

function entriesRows(page: any) {
  return page.locator(`${S.ENTRIES_VIEW} .tabulator-row`);
}

/**
 * Tabulator emits no id attribute on its rows, so rows are addressed by rendered name. The
 * selection handler lives on the cells, not the row element — clicking the row itself is a no-op.
 */
function entriesRowCell(page: any, rowName?: string) {
  return entriesRows(page)
    .filter({ hasText: rowName ?? '' })
    .first()
    .locator('.tabulator-cell')
    .nth(1);
}

async function gotoDrawEntries(page: any, tournamentId: string, eventId: string, drawId: string) {
  await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/drawEntries/${drawId}`);
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  await entriesRows(page).first().waitFor({ state: 'visible', timeout: 10_000 });
}

test.describe('Journey 123 — doubles destroy/re-pair round trip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('re-pairing returns the pair to the draw entries it was destroyed from', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_ADHOC_DOUBLES);
    await new TournamentPage(page).goto(tournamentId);

    const initial = await readDrawState(page);
    const initialPairs = initial.entries.filter((e) => e.participantType === 'PAIR');
    expect(initialPairs.length).toBeGreaterThan(1);

    await gotoDrawEntries(page, tournamentId, initial.eventId, initial.drawId);

    /* ── Destroy one pair → its two individuals become UNGROUPED draw entries ── */

    const pairRow = entriesRowCell(page, initialPairs[0].rowName);
    await pairRow.waitFor({ state: 'visible', timeout: 5_000 });
    await pairRow.click();

    const destroyBtn = page.getByText('Destroy pairs', { exact: true });
    await destroyBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await destroyBtn.click();

    await expect
      .poll(async () => (await readDrawState(page)).entries.filter((e) => e.entryStatus === 'UNGROUPED').length, {
        timeout: 10_000,
      })
      .toBe(2);

    const afterDestroy = await readDrawState(page);
    const ungrouped = afterDestroy.entries.filter((e) => e.entryStatus === 'UNGROUPED');
    expect(afterDestroy.entries.filter((e) => e.participantType === 'PAIR').length).toBe(initialPairs.length - 1);

    /* ── Re-pair the two individuals from the draw-entries view ── */

    for (const entry of ungrouped) {
      const row = entriesRowCell(page, entry.rowName);
      await row.waitFor({ state: 'visible', timeout: 5_000 });
      await row.click();
    }

    // Labelled with its destination: the overlay replaces the pairing row on selection, so the
    // segment toggle is off screen by the time this button appears. A draw view defaults to
    // Accepted.
    const createPairBtn = page.getByText('Create pair as Accepted', { exact: true });
    await createPairBtn.waitFor({ state: 'visible', timeout: 5_000 });

    // The destructive action comes last in both views: "Remove from draw" sits where "Remove from
    // event" sits on the all-entries view, after the pairing actions rather than before them.
    const overlayLabels = await page.locator(`${S.ENTRIES_VIEW} .options_overlay button`).allTextContents();
    const trimmed = overlayLabels.map((label) => label.replace(/\s+/g, ' ').trim());
    expect(trimmed.indexOf('Create pair as Accepted')).toBeLessThan(trimmed.indexOf('Remove from draw'));

    await createPairBtn.click();

    /* ── The draw is whole again ── */

    await expect
      .poll(async () => (await readDrawState(page)).entries.length, { timeout: 10_000 })
      .toBe(initial.entries.length);

    const afterRepair = await readDrawState(page);

    // The individuals are gone from the draw entries — correct, they are grouped now.
    for (const entry of ungrouped) {
      expect(afterRepair.entries.map((e) => e.participantId)).not.toContain(entry.participantId);
    }

    // ...and a PAIR took their place rather than vanishing to the event's alternates.
    expect(afterRepair.entries.filter((e) => e.participantType === 'PAIR').length).toBe(initialPairs.length);

    // In a draw view the segment toggle defaults to Accepted, so the replacement is drawable
    // without a further promotion step.
    const newPair = afterRepair.entries.find(
      (e) => e.participantType === 'PAIR' && !initial.entries.some((i) => i.participantId === e.participantId),
    );
    expect(newPair).toBeDefined();
    expect(newPair?.entryStatus).toBe('DIRECT_ACCEPTANCE');
  });
});
