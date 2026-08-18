import { test, expect, Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_EMPTY_TOURNAMENT } from '../helpers/seed';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 91 — Participants: the "Edit Participant" drawer.
 *
 * The three-dot menu's Edit Participant option opens a drawer that must show the
 * participant's *existing* values, and must save the edits it shows. Both halves
 * had defects with no coverage:
 *
 *   - the country type-ahead was fed `value` rather than `typeAhead.currentValue`,
 *     so it displayed the bare IOC code ('FRA') instead of the flag+name label the
 *     picker offers — the field read as unpopulated;
 *   - the save path read the country back off the *input*, which after a selection
 *     holds the label, not the code. `modifyParticipant` gates nationalityCode on
 *     `validNationalityCode()` and skips it silently, so every country edit was
 *     discarded while Save reported success;
 *   - the Sex "Unknown" option carried no value attribute, so `select.value` fell
 *     back to the option text and a new participant persisted `person.sex: 'Unknown'`
 *     — a display string where a TODS enum belongs.
 *
 * Assertions read the factory record (authoritative) rather than the table DOM.
 */

const ROWS = `${S.TOURNAMENT_PARTICIPANTS} .tabulator-row`;

/**
 * Open a row's three-dot menu. The menu is a tippy created on demand inside
 * Tabulator's cellClick — tipster creates the instance and calls show() within
 * the same click, so the first click is consumed (see Journey 52). Whether the
 * click after that lands depends on whether tippy left its content node behind:
 * `participantActions` opens with a guard that removes any lingering
 * `.tippy-content` and returns. Poll rather than assume a fixed click count.
 */
async function openRowMenu(page: Page, index: number) {
  const threeDots = page.locator(ROWS).nth(index).locator('.fa-ellipsis-vertical');
  const menu = page.locator('.tippy-content .menu-list');
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await menu.isVisible().catch(() => false)) break;
    await threeDots.click({ force: true });
    await page.waitForTimeout(250);
  }
  await expect(menu).toBeVisible({ timeout: 5_000 });
  return menu;
}

async function openEditDrawer(page: Page, index: number) {
  const menu = await openRowMenu(page, index);
  await menu.getByText('Edit Participant').click();
  const drawer = page.locator(S.TMX_DRAWER);
  await expect(drawer.getByPlaceholder('Given name')).toBeVisible({ timeout: 5_000 });
  return drawer;
}

/** The participant the new-participant test creates, or null until it lands. */
async function addedTesty(page: Page) {
  return page.evaluate(
    () => (dev.getTournament().participants ?? []).find((p: any) => p.person?.standardGivenName === 'Testy') ?? null,
  );
}

/** The person record TMX actually persisted, by participantId. */
async function personOf(page: Page, participantId: string) {
  return page.evaluate(
    (id) => (dev.getTournament().participants ?? []).find((p: any) => p.participantId === id)?.person,
    participantId,
  );
}

/** Give participant 0 a fully-populated person so every editor field has something to show. */
async function seedRichParticipant(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const record = dev.getTournament();
    const p = record.participants[0];
    p.participantOtherName = 'Ginny';
    p.person.standardGivenName = 'Virginia';
    p.person.standardFamilyName = 'Sale';
    p.person.birthDate = '1994-03-17';
    p.person.nationalityCode = 'FRA';
    p.person.sex = 'FEMALE';
    dev.factory.tournamentEngine.setState(record);
    await dev.tmx2db.addTournament(record);
    return p.participantId as string;
  });
}

async function gotoParticipants(page: Page, tournamentId: string, view?: string) {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  if (view) {
    await page.goto(`/#/tournament/${tournamentId}/participants/${view}`);
  } else {
    await tournament.navigateToParticipants();
  }
  await page.waitForSelector(ROWS, { timeout: 10_000 });
}

test.describe('Journey 91 — Edit Participant drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('drawer populates every existing value, country as a name not a code', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    await seedRichParticipant(page);
    await gotoParticipants(page, tournamentId);

    const drawer = await openEditDrawer(page, 0);

    await expect(drawer.getByPlaceholder('Given name')).toHaveValue('Virginia');
    await expect(drawer.getByPlaceholder('Family name')).toHaveValue('Sale');
    await expect(drawer.getByPlaceholder('Display name')).toHaveValue('Ginny');
    await expect(drawer.getByPlaceholder('Birthday')).toHaveValue('1994-03-17');
    await expect(drawer.locator('select')).toHaveValue('FEMALE');

    // The regression: the country must arrive as the picker's own label — the
    // country *name* — not the stored IOC code. Matched loosely on the name and
    // asserted against the bare code, deliberately: the flag glyph that prefixes
    // the label is factory's `countryToFlag`, which has its own coverage in
    // factory/src/tests/fixtures/countryFlag.test.ts. Pinning the exact glyph here
    // would make this spec fail or pass on the installed factory version rather
    // than on the behaviour it is meant to guard.
    const country = drawer.getByPlaceholder('Country of origin');
    await expect(country).toHaveValue(/France/);
    await expect(country).not.toHaveValue('FRA');
  });

  test('drawer populates in the Officials and Staff views', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    await page.evaluate(async () => {
      dev.factory.tournamentEngine.addParticipants({
        participants: [
          {
            participantId: 'official-1',
            participantName: 'Roland Referee',
            participantType: 'INDIVIDUAL',
            participantRole: 'OFFICIAL',
            person: {
              standardGivenName: 'Roland',
              standardFamilyName: 'Referee',
              nationalityCode: 'FRA',
              birthDate: '1970-05-05',
              sex: 'MALE',
            },
          },
          {
            participantId: 'coach-1',
            participantName: 'Coco Coach',
            participantType: 'INDIVIDUAL',
            participantRole: 'COACH',
            person: {
              standardGivenName: 'Coco',
              standardFamilyName: 'Coach',
              nationalityCode: 'ESP',
              birthDate: '1980-06-06',
              sex: 'FEMALE',
            },
          },
        ],
      });
      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
    });

    for (const [view, given, family, countryName, iocCode] of [
      ['OFFICIAL', 'Roland', 'Referee', 'France', 'FRA'],
      ['STAFF', 'Coco', 'Coach', 'Spain', 'ESP'],
    ]) {
      await gotoParticipants(page, tournamentId, view);
      const drawer = await openEditDrawer(page, 0);
      await expect(drawer.getByPlaceholder('Given name')).toHaveValue(given);
      await expect(drawer.getByPlaceholder('Family name')).toHaveValue(family);
      const country = drawer.getByPlaceholder('Country of origin');
      await expect(country).toHaveValue(new RegExp(countryName));
      await expect(country).not.toHaveValue(iocCode);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }
  });

  test('saving with no edits preserves every value', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    const participantId = await seedRichParticipant(page);
    await gotoParticipants(page, tournamentId);
    const collector = createMutationCollector(page);

    await openEditDrawer(page, 0);
    await page.getByRole('button', { name: 'Save' }).click();
    await collector.waitForMethod('modifyParticipant', 10_000);

    await expect
      .poll(async () => (await personOf(page, participantId))?.birthDate, { timeout: 8_000 })
      .toBe('1994-03-17');
    const person: any = await personOf(page, participantId);
    expect(person.standardGivenName).toBe('Virginia');
    expect(person.standardFamilyName).toBe('Sale');
    expect(person.nationalityCode).toBe('FRA');
    expect(person.sex).toBe('FEMALE');

    collector.detach();
  });

  test('changing the country persists the IOC code, not the picker label', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    const participantId = await seedRichParticipant(page);
    await gotoParticipants(page, tournamentId);
    const collector = createMutationCollector(page);

    const drawer = await openEditDrawer(page, 0);
    const country = drawer.getByPlaceholder('Country of origin');
    await country.fill('');
    await country.click();
    await country.pressSequentially('Spai', { delay: 80 });
    // The type-ahead auto-selects the first suggestion on Enter.
    await country.press('Enter');
    await expect(country).toHaveValue(/Spain/);

    await page.getByRole('button', { name: 'Save' }).click();
    await collector.waitForMethod('modifyParticipant', 10_000);

    // Before the fix this stayed 'FRA': the label was sent, factory's
    // validNationalityCode() rejected it, and the field was skipped in silence.
    await expect
      .poll(async () => (await personOf(page, participantId))?.nationalityCode, { timeout: 8_000 })
      .toBe('ESP');

    collector.detach();
  });

  test('emptying the country dispatches an explicit clear, without pressing Enter', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    await seedRichParticipant(page);
    await gotoParticipants(page, tournamentId);
    const collector = createMutationCollector(page);

    const drawer = await openEditDrawer(page, 0);
    const country = drawer.getByPlaceholder('Country of origin');
    await expect(country).toHaveValue(/France/);
    // Clear and go straight to Save. The type-ahead's callback only fires on a
    // selection (or Enter in an empty field), so this is the path that used to
    // submit the stale code.
    await country.fill('');
    await page.getByRole('button', { name: 'Save' }).click();

    const entry = await collector.waitForMethod('modifyParticipant', 10_000);
    const params: any = entry.methods.find((m) => m.method === 'modifyParticipant')?.params;

    // Asserted on what TMX DISPATCHES, deliberately — not on the stored record.
    // '' is the engine's explicit clear, and honouring it landed in factory #4599,
    // which is merged but unpublished. TMX resolves factory through link:../factory
    // locally and the published pin in CI, so a persisted-record assertion would pass
    // here and fail there. factory covers its own half in clearPersonFields.test.ts.
    expect(params?.participant?.person?.nationalityCode).toBe('');
    // The rest of the person must still ride along untouched.
    expect(params?.participant?.person?.standardGivenName).toBe('Virginia');
    expect(params?.participant?.person?.birthDate).toBe('1994-03-17');

    collector.detach();
  });

  test('a new participant left at Sex "Unknown" stores no sex, not the label', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    await gotoParticipants(page, tournamentId);
    const collector = createMutationCollector(page);

    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByText('New participant', { exact: false }).click();

    const drawer = page.locator(S.TMX_DRAWER);
    await expect(drawer.getByPlaceholder('Given name')).toBeVisible({ timeout: 5_000 });
    await drawer.getByPlaceholder('Given name').fill('Testy');
    await drawer.getByPlaceholder('Family name').fill('McTest');
    await page.getByRole('button', { name: 'Save' }).click();
    await collector.waitForMethod('addParticipants', 10_000);

    await expect.poll(() => addedTesty(page), { timeout: 8_000 }).not.toBeNull();
    const added: any = await addedTesty(page);

    // Before the fix this was the literal string 'Unknown'.
    expect(added.person.sex).toBeUndefined();
    expect(added.person.standardFamilyName).toBe('McTest');

    collector.detach();
  });
});
