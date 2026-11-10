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

// Keep palette/form/button coverage in TMX's real-browser layer.
test('CODES palette validates, round-trips all colors, preserves selections through reorder and clears', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await seedTournament(page, {
    tournamentName: 'CODES team palette',
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
        .participants.find((p: any) => p.participantName === 'Browser branded team'),
    );
  let drawer = await openEditor(page);
  await drawer.locator('input').first().fill('Browser branded team');
  const palette = drawer.locator('.team-palette-editor');
  for (const [name, value] of [
    ['Red', 'red'],
    ['White', '#ffffff'],
    ['Black', '#000000'],
    ['Gold', '#fcd116'],
  ]) {
    await palette.getByRole('button', { name: 'Add color', exact: true }).click();
    const row = palette.locator('.team-palette-row').last();
    await row.getByPlaceholder('Color name (optional)').fill(name);
    await row.getByPlaceholder('#RRGGBB').fill(value);
    await row.getByPlaceholder('Brand group (optional)').fill('Primary');
  }
  await palette.getByLabel('Scoreboard accent', { exact: true }).selectOption({ label: 'Red' });
  await palette.getByLabel('Scoreboard trim (optional)', { exact: true }).selectOption({ label: 'Gold' });
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(drawer).toBeVisible();
  await expect(palette.getByRole('alert')).not.toBeEmpty();
  expect(await team()).toBeUndefined();
  await palette.locator('.team-palette-row').first().getByPlaceholder('#RRGGBB').fill('#ce1126');
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect.poll(async () => (await team())?.teamColors?.palette.length).toBe(4);
  const created = await team();
  expect(created.teamColors.palette.map((entry: any) => entry.group)).toEqual([
    'Primary',
    'Primary',
    'Primary',
    'Primary',
  ]);
  const originalDisplay = created.teamColors.display;

  await page.reload();
  await waitForAppReady(page);
  await initDevBridge(page);
  drawer = await openEditor(page, created.participantId);
  const editor = drawer.locator('.team-palette-editor');
  await expect(editor.locator('.team-palette-row')).toHaveCount(4);
  await expect(editor.getByLabel('Scoreboard accent', { exact: true })).toHaveValue(originalDisplay.primary);
  await expect(editor.getByLabel('Scoreboard trim (optional)', { exact: true })).toHaveValue(originalDisplay.secondary);
  await editor.locator('.team-palette-row').last().getByRole('button', { name: 'Move color up', exact: true }).click();
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  expect((await team()).teamColors.display).toEqual(originalDisplay);
  expect((await team()).teamColors.palette.map((entry: any) => entry.name)).toEqual(['Red', 'White', 'Gold', 'Black']);

  drawer = await openEditor(page, created.participantId);
  await drawer.locator('.team-palette-row').first().getByRole('button', { name: 'Remove color', exact: true }).click();
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(drawer).toBeVisible();
  expect((await team()).teamColors.palette).toHaveLength(4);
  await drawer.getByLabel('Scoreboard accent', { exact: true }).selectOption({ label: 'White' });
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect.poll(async () => (await team()).teamColors.palette.length).toBe(3);

  drawer = await openEditor(page, created.participantId);
  await drawer.getByRole('button', { name: 'Clear palette', exact: true }).click();
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  expect((await team()).teamColors.palette).toHaveLength(3);
  drawer = await openEditor(page, created.participantId);
  await drawer.getByRole('button', { name: 'Clear palette', exact: true }).click();
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect.poll(async () => (await team())?.teamColors).toBeUndefined();
});
