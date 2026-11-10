import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { seedTournament } from '../helpers/seed';
import { S } from '../helpers/selectors';

async function openEditor(page: Page, participantId?: string) {
  await page.evaluate(async (id) => {
    const modulePath = '/src/pages/tournament/tabs/participantTab/editGroupingParticipant.ts';
    const { editGroupingParticipant } = await import(modulePath);
    const participant = id
      ? dev.factory.tournamentEngine.getParticipants().participants.find((entry: any) => entry.participantId === id)
      : undefined;
    editGroupingParticipant({ participantType: 'TEAM', participant });
  }, participantId);
  const drawer = page.locator(`${S.TMX_DRAWER} .drawer__wrapper`);
  await expect(drawer).toBeVisible();
  return drawer;
}

// Keep DOM coverage in TMX's real-browser layer. The production form, drawer and buttons are all used.
test('TEAM colors validate without closing, persist, replace, clear and cancel', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await seedTournament(page, {
    tournamentName: 'Team color editor',
    participantsProfile: { scaledParticipantsCount: 8 },
    drawProfiles: [],
  });
  await page.evaluate(() => {
    dev.env.serverFirst = false;
  });
  const team = () =>
    page.evaluate(() =>
      dev.factory.tournamentEngine
        .getParticipants()
        .participants.find((participant: any) => participant.participantName === 'Browser branded team'),
    );
  let drawer = await openEditor(page);
  await drawer.locator('input').first().fill('Browser branded team');
  const primary = drawer.getByPlaceholder('#RRGGBB').nth(0);
  const secondary = drawer.getByPlaceholder('#RRGGBB').nth(1);
  await primary.fill('red');
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(drawer).toBeVisible();
  expect(await team()).toBeUndefined();
  await primary.fill('#aabbcc');
  await secondary.fill('#112233');
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect.poll(async () => (await team())?.teamColors).toEqual({ primary: '#AABBCC', secondary: '#112233' });
  const participantId = (await team()).participantId;

  // Reload the persisted record before reopening the production editor.
  await page.reload();
  await waitForAppReady(page);
  await initDevBridge(page);
  drawer = await openEditor(page, participantId);
  await expect(drawer.getByPlaceholder('#RRGGBB').nth(0)).toHaveValue('#AABBCC');
  await expect(drawer.getByPlaceholder('#RRGGBB').nth(1)).toHaveValue('#112233');
  await drawer.getByPlaceholder('#RRGGBB').nth(0).fill('#ffeedd');
  await drawer.getByPlaceholder('#RRGGBB').nth(1).fill('');
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await team())?.teamColors).toEqual({ primary: '#FFEEDD' });

  drawer = await openEditor(page, participantId);
  await drawer.getByPlaceholder('#RRGGBB').nth(0).fill('red');
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  expect((await team()).teamColors).toEqual({ primary: '#FFEEDD' });
  drawer = await openEditor(page, participantId);
  await drawer.getByPlaceholder('#RRGGBB').nth(0).fill('');
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await team())?.teamColors).toBeUndefined();
});
