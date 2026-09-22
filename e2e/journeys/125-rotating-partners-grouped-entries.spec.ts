/**
 * Journey 125 — Rotating partners: pairing individuals who are already paired, in an AD_HOC draw
 *
 * AD_HOC entries are a roster, not a field, so the factory allows PAIRs that share an individual
 * there (and keeps one person out of two matchUps of the same round). TMX offered no way to create
 * one: an individual who is already paired is not an entry, so they never appeared to be selected.
 *
 * The draw-entries view of an AD_HOC doubles draw now has a "Rotating partners" toggle. When ON, each
 * individual of the draw's PAIR entries is shown as a virtual [Grouped] row that supports pairing only.
 * A pair that shares an individual enters the DRAW as the chosen segment and the EVENT as ALTERNATE,
 * so a bracketed flight generated from the event's accepted entries is not blocked by the overlap.
 *
 * The toggle is not persisted: it starts ON when the draw already holds pairs sharing an individual.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

const PROFILE_ADHOC_DOUBLES: MockProfile = {
  tournamentName: 'E2E Rotating Partners',
  tournamentAttributes: { tournamentId: 'e2e-rotating-partners' },
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

type PairInfo = { participantId: string; names: string[]; individualIds: string[] };
type State = {
  eventId: string;
  drawId: string;
  drawEntries: { participantId: string; entryStatus: string }[];
  eventEntries: { participantId: string; entryStatus: string }[];
  pairs: PairInfo[];
};

async function readState(page: any): Promise<State> {
  return page.evaluate(() => {
    const engine = (dev as any).factory.tournamentEngine;
    const tournamentRecord = (dev as any).getTournament();
    const event = tournamentRecord.events[0];
    const drawDefinition = event.drawDefinitions[0];
    const { participants } = engine.getParticipants();
    const byId = new Map(participants.map((p: any) => [p.participantId, p]));
    const drawEntries = (drawDefinition.entries ?? []).map(({ participantId, entryStatus }: any) => ({
      participantId,
      entryStatus,
    }));
    const pairs = drawEntries
      .map(({ participantId }: any) => byId.get(participantId) as any)
      .filter((p: any) => p?.participantType === 'PAIR')
      .map((p: any) => ({
        participantId: p.participantId,
        individualIds: p.individualParticipantIds,
        names: p.individualParticipantIds.map((id: string) => (byId.get(id) as any)?.participantName),
      }));
    return {
      eventId: event.eventId,
      drawId: drawDefinition.drawId,
      eventEntries: (event.entries ?? []).map(({ participantId, entryStatus }: any) => ({
        participantId,
        entryStatus,
      })),
      drawEntries,
      pairs,
    };
  });
}

function entriesRows(page: any) {
  return page.locator(`${S.ENTRIES_VIEW} .tabulator-row`);
}

/**
 * A PAIR row renders both individuals' names, so a name alone matches the PAIR row too. A Grouped row
 * is addressed by its chip AND the individual's name. Selection handlers live on the cells.
 */
function groupedRowCell(page: any, name: string) {
  return entriesRows(page)
    .filter({ has: page.locator('.tag', { hasText: /^Grouped$/ }) })
    .filter({ hasText: name })
    .first()
    .locator('.tabulator-cell')
    .nth(1);
}

async function gotoDrawEntries(page: any, tournamentId: string, eventId: string, drawId: string) {
  await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/drawEntries/${drawId}`);
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  await entriesRows(page).first().waitFor({ state: 'visible', timeout: 10_000 });
}

const groupedChips = (page: any) => page.locator(`${S.ENTRIES_VIEW} .tag`, { hasText: /^Grouped$/ });

/**
 * Tabulator renders only the rows in view, so a chip count measures the viewport, not the data. The
 * scope selector's "Grouped (N)" label counts every row; choosing it also filters the table to the
 * Grouped rows so the ones a test clicks are in view.
 */
async function scopeToGrouped(page: any): Promise<number> {
  await page.locator(S.EVENT_CONTROL).getByText('All', { exact: true }).first().click();
  const option = page.getByText(/^Grouped \(\d+\)$/).first();
  await option.waitFor({ state: 'visible', timeout: 5_000 });
  const count = Number((await option.textContent())?.match(/\((\d+)\)/)?.[1]);
  await option.click();
  return count;
}
const overlayButtons = async (page: any) =>
  (await page.locator(`${S.ENTRIES_VIEW} .options_overlay button`).allTextContents()).map((label: string) =>
    label.replace(/\s+/g, ' ').trim(),
  );

test.describe('Journey 125 — rotating partners in an AD_HOC doubles draw', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('pairs two already-paired individuals into the draw, as an event alternate', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    const tournamentId = await seedTournament(page, PROFILE_ADHOC_DOUBLES);
    await new TournamentPage(page).goto(tournamentId);

    const initial = await readState(page);
    expect(initial.pairs.length).toBeGreaterThanOrEqual(2);
    const [first, second] = initial.pairs;

    await gotoDrawEntries(page, tournamentId, initial.eventId, initial.drawId);

    /* ── No overlapping pairs yet: the mode starts OFF and there are no Grouped rows ── */

    const toggle = page.locator('#rotating-partners-toggle');
    await expect(toggle).toHaveText('Rotating partners: OFF');
    await expect(groupedChips(page)).toHaveCount(0);

    await toggle.click();
    await expect(page.locator('#rotating-partners-toggle')).toHaveText('Rotating partners: ON');
    await expect(groupedChips(page).first()).toBeAttached();
    // one Grouped row per individual of every PAIR entry
    expect(await scopeToGrouped(page)).toBe(initial.pairs.length * 2);

    /* ── Existing partners cannot be paired again ── */

    await groupedRowCell(page, first.names[0]).click();
    await groupedRowCell(page, first.names[1]).click();
    await page.waitForTimeout(300);
    expect((await overlayButtons(page)).some((label: string) => label.startsWith('Create pair'))).toBe(false);
    // Grouped rows are not draw entries: nothing that acts on entries is offered for them
    expect(await overlayButtons(page)).not.toContain('Remove from draw');
    // clicking a selected row again deselects it
    await groupedRowCell(page, first.names[0]).click();
    await groupedRowCell(page, first.names[1]).click();
    await expect.poll(async () => (await overlayButtons(page)).length, { timeout: 5_000 }).toBe(0);

    /* ── Two individuals from different pairs can ── */

    await groupedRowCell(page, first.names[0]).click();
    await groupedRowCell(page, second.names[0]).click();
    const createPairBtn = page.getByText('Create pair as Accepted', { exact: true });
    await createPairBtn.waitFor({ state: 'visible', timeout: 5_000 });
    expect(await overlayButtons(page)).not.toContain('Remove from draw');
    await createPairBtn.click();

    await expect
      .poll(async () => (await readState(page)).drawEntries.length, { timeout: 10_000 })
      .toBe(initial.drawEntries.length + 1);

    const after = await readState(page);
    const newPair = after.pairs.find((p) => !initial.pairs.some((i) => i.participantId === p.participantId));
    expect(newPair).toBeDefined();
    expect(newPair?.individualIds.sort()).toEqual([first.individualIds[0], second.individualIds[0]].sort());

    // the original pairs are untouched
    for (const pair of initial.pairs) {
      expect(after.drawEntries.map((e) => e.participantId)).toContain(pair.participantId);
    }

    // accepted in the AD_HOC draw, an alternate in the event
    expect(after.drawEntries.find((e) => e.participantId === newPair?.participantId)?.entryStatus).toBe(
      'DIRECT_ACCEPTANCE',
    );
    expect(after.eventEntries.find((e) => e.participantId === newPair?.participantId)?.entryStatus).toBe('ALTERNATE');

    /* ── Not persisted, but derived: re-opening the draw's entries starts in the mode ── */

    await page.goto(`/#/tournament/${tournamentId}/event/${initial.eventId}`);
    await gotoDrawEntries(page, tournamentId, initial.eventId, initial.drawId);
    await expect(page.locator('#rotating-partners-toggle')).toHaveText('Rotating partners: ON');
    // the new pair adds no Grouped row: both its members were already grouped, and each appears once
    expect(await scopeToGrouped(page)).toBe(initial.pairs.length * 2);

    expect(errors).toEqual([]);
  });

  test("pairs an event's ungrouped individual with a grouped one, into the draw", async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    const tournamentId = await seedTournament(page, PROFILE_ADHOC_DOUBLES);
    await new TournamentPage(page).goto(tournamentId);

    // every seeded individual is paired, so add one more and enter them as an UNGROUPED event entry —
    // an event entry, not a draw entry
    const loneName: string = await page.evaluate(() => {
      const engine = (dev as any).factory.tournamentEngine;
      const eventId = (dev as any).getTournament().events[0].eventId;
      const added = engine.addParticipant({
        participant: {
          participantType: 'INDIVIDUAL',
          participantRole: 'COMPETITOR',
          person: { standardGivenName: 'Rotating', standardFamilyName: 'Lone' },
        },
        returnParticipant: true,
      });
      const participantId = added.participant.participantId;
      const entered = engine.addEventEntries({ eventId, participantIds: [participantId], entryStatus: 'UNGROUPED' });
      if (!entered.success) throw new Error(JSON.stringify(entered.error));
      return added.participant.participantName;
    });

    const initial = await readState(page);
    const [first] = initial.pairs;
    await gotoDrawEntries(page, tournamentId, initial.eventId, initial.drawId);

    const toggle = page.locator('#rotating-partners-toggle');
    await toggle.click();
    await expect(page.locator('#rotating-partners-toggle')).toHaveText('Rotating partners: ON');

    // the event-only individual is listed as Ungrouped in the draw view
    await page.locator(S.EVENT_CONTROL).getByText('All', { exact: true }).first().click();
    await page
      .getByText(/^Ungrouped \(1\)$/)
      .first()
      .click();
    const loneRow = entriesRows(page).filter({ hasText: loneName }).first().locator('.tabulator-cell').nth(1);
    await loneRow.click();
    // it is not a draw entry: nothing that acts on draw entries is offered
    await page.waitForTimeout(300);
    expect(await overlayButtons(page)).not.toContain('Remove from draw');

    await scopeToGrouped(page);
    await groupedRowCell(page, first.names[0]).click();
    const createPairBtn = page.getByText('Create pair as Accepted', { exact: true });
    await createPairBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await createPairBtn.click();

    await expect
      .poll(async () => (await readState(page)).drawEntries.length, { timeout: 10_000 })
      .toBe(initial.drawEntries.length + 1);

    const after = await readState(page);
    const newPair = after.pairs.find((p) => !initial.pairs.some((i) => i.participantId === p.participantId));
    expect(newPair?.names).toContain(loneName);
    expect(newPair?.names).toContain(first.names[0]);
    expect(after.drawEntries.find((e) => e.participantId === newPair?.participantId)?.entryStatus).toBe(
      'DIRECT_ACCEPTANCE',
    );
    expect(after.eventEntries.find((e) => e.participantId === newPair?.participantId)?.entryStatus).toBe('ALTERNATE');
    // the lone individual is grouped now, so the factory removed their UNGROUPED event entry
    expect(after.eventEntries.some((e) => e.entryStatus === 'UNGROUPED')).toBe(false);

    expect(errors).toEqual([]);
  });

  test('the toggle is offered only in an AD_HOC draw view, never on all entries', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_ADHOC_DOUBLES);
    await new TournamentPage(page).goto(tournamentId);
    const initial = await readState(page);

    await page.goto(`/#/tournament/${tournamentId}/event/${initial.eventId}`);
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
    await entriesRows(page).first().waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator('#pairing-mode-toggle')).toBeVisible();
    await expect(page.locator('#rotating-partners-toggle')).toHaveCount(0);
  });
});
