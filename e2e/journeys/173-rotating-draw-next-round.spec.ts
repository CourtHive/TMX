import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { test, expect } from '@playwright/test';

for (const format of ['AMERICANO', 'MEXICANO']) {
  test(`creates ${format} from AD HOC and completes round one and generates round two through Round actions`, async ({
    page,
  }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
    const tournamentId = await page.evaluate(async () => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        participantsProfile: { participantsCount: 32 },
      });
      tournamentRecord.events = [
        { eventId: 'rotating-doubles', eventName: 'Rotating Doubles', eventType: 'DOUBLES', entries: [] },
      ];
      await dev.load(tournamentRecord);
      return tournamentRecord.tournamentId;
    });
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.getByRole('button', { name: 'Add draw' }).click();
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();
    await expect(page.locator('#rotatingFormat')).toBeHidden();
    await drawer.selectDrawType('AD_HOC');
    const placement = await drawer
      .fieldSelect('Draw Type')
      .evaluate((element) => !!element.closest('.field')!.nextElementSibling?.querySelector('#rotatingFormat'));
    expect(placement).toBe(true);
    const colors = await drawer.fieldSelect('Draw Type').evaluate((element) => {
      const actual = getComputedStyle(document.getElementById('rotatingFormat')!);
      const expected = getComputedStyle(element);
      return { actual: [actual.color, actual.backgroundColor], expected: [expected.color, expected.backgroundColor] };
    });
    expect(colors.actual).toEqual(colors.expected);
    await page.locator('#rotatingFormat').selectOption(format);
    await page.locator('#rotatingFormat').selectOption('STANDARD');
    await expect(drawer.fieldInput('Draw size')).toBeVisible();
    await page.locator('#rotatingFormat').selectOption(format);
    await expect(drawer.fieldInput('Draw size')).toBeHidden();
    const rosterStyle = await page.locator('#rotatingRoster').evaluate((element) => {
      const style = getComputedStyle(element);
      const row = element.querySelector('label')!;
      const heading = element.closest('.field')!.querySelector('.label')!;
      return {
        maxHeight: style.maxHeight,
        rowWeight: getComputedStyle(row).fontWeight,
        rowSize: Number.parseFloat(getComputedStyle(row).fontSize),
        headingSize: Number.parseFloat(getComputedStyle(heading).fontSize),
        height: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    });
    expect(rosterStyle.maxHeight).toBe('none');
    expect(rosterStyle.rowWeight).toBe('400');
    expect(rosterStyle.rowSize).toBeLessThan(rosterStyle.headingSize);
    expect(rosterStyle.height).toBe(rosterStyle.scrollHeight);
    const checkboxes = await page.locator('#rotatingRoster input').all();
    expect(checkboxes).toHaveLength(32);
    for (const checkbox of checkboxes.slice(0, 6)) await checkbox.check();
    await drawer.clickGenerate();
    await expect(page.getByText('Select between 4 and 128 individual players, in multiples of four.')).toBeVisible();
    await expect(page.locator('#rotatingFormat')).toBeVisible();
    expect(await page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.length ?? 0)).toBe(0);
    for (const checkbox of checkboxes.slice(6, 8)) await checkbox.check();
    await drawer.clickGenerate();
    await drawer.waitForClose();
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.[0]?.competitionProfile?.format))
      .toBe(format);
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.[0]?.entries?.length))
      .toBe(8);
    await page.getByRole('button', { name: 'Generate round', exact: true }).click();
    await expect(page.getByText('Preview round 1', { exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Generate round', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.[0]?.competitionRounds?.length))
      .toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.[0]?.structures?.[0]?.matchUps?.length),
      )
      .toBe(2);
    await page.evaluate(async () => {
      const drawId = dev.getTournament().events[0].drawDefinitions[0].drawId;
      const methods = dev.factory.tournamentEngine.allDrawMatchUps({ drawId }).matchUps.map((match: any) => ({
        method: 'setMatchUpStatus',
        params: {
          drawId,
          matchUpId: match.matchUpId,
          outcome: {
            matchUpStatus: 'COMPLETED',
            winningSide: 1,
            score: { sets: [{ setNumber: 1, side1Score: 20, side2Score: 12, winningSide: 1 }] },
          },
        },
      }));
      await new Promise<void>((resolve, reject) =>
        dev.mutationRequest({
          methods,
          callback: (result: any) => {
            if (result.success) resolve();
            else reject(new Error(JSON.stringify(result)));
          },
        }),
      );
    });
    await page.getByRole('button', { name: 'Round actions', exact: true }).click();
    await page.getByText('Generate round', { exact: true }).click();
    await expect(page.getByText('Preview round 2', { exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Generate round', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          dev.getTournament().events[0].drawDefinitions[0].competitionRounds.map((round: any) => round.roundNumber),
        ),
      )
      .toEqual([1, 2]);
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().events[0].drawDefinitions[0].structures[0].matchUps.length))
      .toBe(4);
  });
}
