import { initDevBridge, loginAsSuperAdmin, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { expect, test, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';

// Merging is for a provider administrator on a provider that has opted in (provider-config 1.2.0), so the journey
// runs logged in. A logged-in session opens a provider-bound record locally only while it is held offline for the
// session's email (journey 163's shape), which also keeps every mutation local: no server is needed.
const DIRECTOR_EMAIL = 'td@e2e';

// 'held': provider-bound and held offline for DIRECTOR_EMAIL; 'bound': provider-bound only; 'standalone': no provider.
type Binding = 'held' | 'bound' | 'standalone';

async function seedDuplicates(page: Page, sharedDraw = false, binding: Binding = 'held') {
  return page.evaluate(
    async ({ shared, email, binding }) => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        tournamentAttributes: { tournamentName: 'Participant merge review' },
        ...(shared ? { drawProfiles: [{ drawSize: 4 }] } : {}),
      });
      if (shared) {
        const people = tournamentRecord.participants.filter((p: any) => p.participantType === 'INDIVIDUAL');
        const [a, b] = people;
        const id = b.participantId;
        Object.assign(b, structuredClone(a), { participantId: id });
      } else {
        tournamentRecord.participants = ['source', 'target'].map((participantId) => ({
          participantId,
          participantType: 'INDIVIDUAL',
          participantRole: 'COMPETITOR',
          participantName: 'Ana Rivas',
          person: {
            personId: '00000000-0000-4000-8000-000000000001',
            standardGivenName: 'Ana',
            standardFamilyName: 'Rivas',
          },
        }));
      }
      if (binding !== 'standalone') {
        tournamentRecord.parentOrganisation = { organisationId: 'e2e-provider', organisationName: 'E2E Provider' };
      }
      if (binding === 'held') {
        tournamentRecord.timeItems = [
          ...(tournamentRecord.timeItems ?? []),
          { itemType: 'TMX', itemValue: { offline: { email } } },
        ];
      }
      await dev.tmx2db.initDB();
      await dev.tmx2db.addTournament(tournamentRecord);
      await dev.load(tournamentRecord);
      return tournamentRecord.tournamentId;
    },
    { shared: sharedDraw, email: DIRECTOR_EMAIL, binding },
  );
}

async function setMergeOptIn(page: Page, allowed: boolean) {
  await page.evaluate(
    (canMergeParticipants) => dev.providerConfig.set({ permissions: { canMergeParticipants } }),
    allowed,
  );
}

async function openReview(page: Page) {
  const rows = page.locator('#tournamentParticipants .tabulator-row');
  await expect(rows.first()).toBeVisible();
  await rows.nth(0).locator('input[type="checkbox"]').first().click();
  await rows.nth(1).locator('input[type="checkbox"]').first().click();
  await page.getByText('Merge participants', { exact: true }).click();
  await expect(page.locator('#individualMergeTarget')).toBeVisible();
}

test.describe('individual participant merge review', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/factory/capabilities', (route) =>
      route.fulfill({ json: { individualParticipantMerge: true } }),
    );
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await loginAsSuperAdmin(page, { email: DIRECTOR_EMAIL });
    await setMergeOptIn(page, true);
  });

  test('merges the selected duplicate and retains one individual', async ({ page }) => {
    const tid = await seedDuplicates(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    await openReview(page);
    await page.locator('#individualMergeTarget').selectOption('target');
    await expect(page.locator('#individualMergeConfirm')).toBeEnabled();
    await page.screenshot({ path: '/private/tmp/individual-merge-review.png' });
    await page.locator('#individualMergeConfirm').click();
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().participants.map((p: any) => p.participantId)))
      .toEqual(['target']);
    await expect(page.locator('#individualMergeTarget')).not.toBeVisible();
  });

  test('refuses two entrants in the same draw', async ({ page }) => {
    const tid = await seedDuplicates(page, true);
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    await openReview(page);
    await expect(page.getByText('Both individuals occur in this draw.', { exact: false })).toBeVisible();
    await expect(page.locator('#individualMergeConfirm')).toBeDisabled();
  });
  test('cancel keeps both identities and a server without support hides the action', async ({ page }) => {
    const tid = await seedDuplicates(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    await openReview(page);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => dev.getTournament().participants.length)).toBe(2);
    await page.route('**/factory/capabilities', (route) =>
      route.fulfill({ json: { individualParticipantMerge: false } }),
    );
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    const rows = page.locator('#tournamentParticipants .tabulator-row');
    await rows.nth(0).locator('input[type="checkbox"]').first().click();
    await rows.nth(1).locator('input[type="checkbox"]').first().click();
    await expect(page.locator('#individualMergeAction')).toBeHidden();
  });

  test('a provider that has not opted in is never offered the action', async ({ page }) => {
    const tid = await seedDuplicates(page);
    await setMergeOptIn(page, false);
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    const rows = page.locator('#tournamentParticipants .tabulator-row');
    await expect(rows.first()).toBeVisible();
    await rows.nth(0).locator('input[type="checkbox"]').first().click();
    await rows.nth(1).locator('input[type="checkbox"]').first().click();
    await expect(page.locator('#individualMergeAction')).toBeHidden();
  });

  test('requires a field choice before merging conflicting birth dates', async ({ page }) => {
    const tid = await seedDuplicates(page);
    await page.evaluate(async () => {
      const record = dev.getTournament();
      record.participants[0].person.birthDate = '1990-01-01';
      record.participants[1].person.birthDate = '1991-01-01';
      await dev.load(record);
    });
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    await openReview(page);
    await page.locator('#individualMergeTarget').selectOption('target');
    await expect(page.locator('#individualMergeConfirm')).toBeDisabled();
    await page.getByLabel('Birth date', { exact: false }).selectOption('source');
    await expect(page.locator('#individualMergeConfirm')).toBeEnabled();
    await page.locator('#individualMergeConfirm').click();
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().participants[0].person.birthDate))
      .toBe('1990-01-01');
    expect(await page.evaluate(() => dev.getTournament().participants.length)).toBe(1);
  });

  test('collapses duplicate entries in one event and asks which entry status to keep', async ({ page }) => {
    const tid = await seedDuplicates(page);
    await page.evaluate(async () => {
      const record = dev.getTournament();
      record.events = [
        {
          eventId: 'open-singles',
          eventName: 'Open Singles',
          eventType: 'SINGLES',
          entries: [
            { participantId: 'source', entryStatus: 'ALTERNATE', entryStage: 'MAIN', entryPosition: 1 },
            { participantId: 'target', entryStatus: 'DIRECT_ACCEPTANCE', entryStage: 'MAIN', entryPosition: 2 },
          ],
        },
      ];
      await dev.load(record);
    });
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    await openReview(page);
    await page.locator('#individualMergeTarget').selectOption('target');
    await expect(page.locator('#individualMergeConfirm')).toBeDisabled();
    await page.getByLabel('Open Singles — Entry status', { exact: false }).selectOption('target');
    await expect(page.locator('#individualMergeConfirm')).toBeEnabled();
    await page.locator('#individualMergeConfirm').click();
    await expect.poll(() => page.evaluate(() => dev.getTournament().participants.length)).toBe(1);
    expect(
      await page.evaluate(() =>
        dev.getTournament().events[0].entries.map((e: any) => [e.participantId, e.entryStatus]),
      ),
    ).toEqual([['target', 'DIRECT_ACCEPTANCE']]);
  });

  test('merges one reviewed pair in a tournament with 857 individuals', async ({ page }) => {
    const tid = await seedDuplicates(page);
    await page.evaluate(async () => {
      const record = dev.getTournament();
      for (let index = 0; index < 855; index++) {
        record.participants.push({
          participantId: `other-${index}`,
          participantType: 'INDIVIDUAL',
          participantRole: 'COMPETITOR',
          participantName: `Player ${index}`,
          person: {
            personId: `00000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}`,
            standardGivenName: 'Player',
            standardFamilyName: String(index),
          },
        });
      }
      // Every individual is entered, the duplicates included, as in the imported record that prompted this review.
      record.events = [
        {
          eventId: 'open-singles',
          eventName: 'Open Singles',
          eventType: 'SINGLES',
          entries: record.participants.map((p: any, index: number) => ({
            participantId: p.participantId,
            entryStatus: 'DIRECT_ACCEPTANCE',
            entryStage: 'MAIN',
            entryPosition: index + 1,
          })),
        },
      ];
      await dev.load(record);
    });
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    await openReview(page);
    await page.locator('#individualMergeTarget').selectOption('target');
    await expect(page.locator('#individualMergeConfirm')).toBeEnabled();
    await page.locator('#individualMergeConfirm').click();
    await expect.poll(() => page.evaluate(() => dev.getTournament().participants.length)).toBe(856);
    expect(await page.evaluate(() => dev.getTournament().events[0].entries.length)).toBe(856);
    expect(
      await page.evaluate(
        () => dev.getTournament().participants.filter((p: any) => p.participantId.startsWith('other-')).length,
      ),
    ).toBe(855);
  });
  test('keeps the review readable in a narrow light layout', async ({ page }) => {
    const tid = await seedDuplicates(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await openReview(page);
    await expect(page.locator('#individualMergeConfirm')).toBeVisible();
    const box = await page.locator('#individualMergeTarget').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    for (const button of [
      page.locator('#individualMergeConfirm'),
      page.getByRole('button', { name: 'Cancel', exact: true }),
    ]) {
      const bounds = await button.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    }
    await page.screenshot({ path: '/private/tmp/individual-merge-review-light-mobile.png' });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => dev.getTournament().participants.length)).toBe(2);
  });
});

// A logged-out tournament with no parent organisation has no provider to opt in and no server to consult, so the merge
// is offered and runs on the local engine. That is what makes it demonstrable without a provider.
test.describe('individual participant merge on a standalone local tournament', () => {
  test.beforeEach(async ({ page }) => {
    // No server takes part: a server that says it cannot merge must not hide the action.
    await page.route('**/factory/capabilities', (route) =>
      route.fulfill({ json: { individualParticipantMerge: false } }),
    );
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('logged out, a tournament with no provider merges without any opt-in', async ({ page }) => {
    const tid = await seedDuplicates(page, false, 'standalone');
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    await openReview(page);
    await page.locator('#individualMergeTarget').selectOption('target');
    await page.locator('#individualMergeConfirm').click();
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().participants.map((p: any) => p.participantId)))
      .toEqual(['target']);
  });

  test('logged out, a provider-bound tournament is never offered the action', async ({ page }) => {
    const tid = await seedDuplicates(page, false, 'bound');
    const tournament = new TournamentPage(page);
    await tournament.goto(tid);
    await tournament.navigateToParticipants();
    const rows = page.locator('#tournamentParticipants .tabulator-row');
    await expect(rows.first()).toBeVisible();
    await rows.nth(0).locator('input[type="checkbox"]').first().click();
    await rows.nth(1).locator('input[type="checkbox"]').first().click();
    await expect(page.locator('#individualMergeAction')).toBeHidden();
  });
});
