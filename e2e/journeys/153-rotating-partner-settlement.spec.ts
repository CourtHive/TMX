/** Requires a factory build containing the rotating-partner settlement API. No silent capability skip. */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page) {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  return page.evaluate(async () => {
    const factory: any = dev.factory;
    const engine = factory.tournamentEngine;
    if (typeof engine.settleRotatingPartnerResult !== 'function')
      throw new Error('Journey 153 requires the rotating-partner factory build');
    const { tournamentRecord } = factory.mocksEngine.generateTournamentRecord({
      participantsProfile: { participantsCount: 8 },
      setState: true,
      nonRandom: 1,
      tournamentAttributes: { tournamentId: 'settlement-e2e', startDate: '2026-01-01', endDate: '2036-12-31' },
    });
    const ids = tournamentRecord.participants.map((participant: any) => participant.participantId);
    tournamentRecord.events = [
      {
        eventId: 'settlement-event',
        eventName: 'Mexicano',
        eventType: 'DOUBLES',
        entries: ids.map((participantId: string) => ({ participantId, entryStatus: 'UNGROUPED' })),
        drawDefinitions: [
          {
            drawId: 'settlement-draw',
            drawName: 'Mexicano',
            drawType: 'AD_HOC',
            matchUpType: 'DOUBLES',
            entries: ids.map((participantId: string) => ({ participantId, entryStatus: 'DIRECT_ACCEPTANCE' })),
            structures: [{ structureId: 'settlement-structure', matchUps: [] }],
            competitionProfile: {
              version: 1,
              format: 'MEXICANO',
              entrantScope: 'INDIVIDUAL',
              matchUpType: 'DOUBLES',
              pairing: {
                seed: 42,
                algorithmVersion: 1,
                groupBy: 'ADJACENT_STANDINGS',
                partners: 'FIRST_FOURTH_SECOND_THIRD',
              },
              scoring: { combinedPointTotal: 32, selectedVariant: { tieResolution: 'ALLOW' } },
              standings: { metric: 'SIDE_POINTS', attribution: 'EACH_INDIVIDUAL' },
              completion: { kind: 'ROUND_COUNT', rounds: 3 },
            },
          },
        ],
      },
    ];
    engine.setState(tournamentRecord);
    const drawId = 'settlement-draw';
    const preview = engine.getRotatingPartnerRoundPreview({ drawId, roundNumber: 1 });
    if (preview.error) throw new Error(preview.info ?? preview.error.message);
    const applied = engine.generateRotatingPartnerRound({
      drawId,
      roundNumber: 1,
      requestId: 'round-one',
      expectedPairings: preview.round,
      expectedScoringContract: preview.scoringContract,
    });
    if (applied.error) throw new Error(applied.info ?? applied.error.message);
    const matchUpId = applied.roundRecord.matchUpIds[0];
    const scored = engine.setMatchUpStatus({
      drawId,
      matchUpId,
      outcome: {
        matchUpStatus: 'RETIRED',
        winningSide: 1,
        score: { sets: [{ setNumber: 1, side1Score: 10, side2Score: 8 }] },
      },
    });
    if (scored.error) throw new Error(scored.info ?? scored.error.message);
    await dev.load({ tournamentRecord: engine.getTournament().tournamentRecord });
    return { drawId, matchUpId };
  });
}

async function open(page: Page, ids: { drawId: string; matchUpId: string }) {
  await page.evaluate(async (ids) => {
    const path = '/src/components/modals/rotatingPartnerSettlement.ts';
    const { openRotatingPartnerSettlement } = await import(/* @vite-ignore */ path);
    openRotatingPartnerSettlement(ids);
  }, ids);
  await expect(page.getByRole('button', { name: 'Confirm settlement' })).toBeDisabled();
  await page.getByLabel('Recorded by', { exact: true }).fill('Local director');
}

test('reason and reviewed four-player impact are required; an input change invalidates approval', async ({ page }) => {
  const ids = await prepare(page);
  await open(page, ids);
  await page.getByRole('button', { name: 'Preview standings' }).click();
  await expect(page.getByRole('button', { name: 'Confirm settlement' })).toBeDisabled();
  await page.getByLabel('Reason (required)', { exact: true }).fill('Retirement ruling');
  await page.getByLabel('Standings treatment', { exact: true }).selectOption('CREDIT');
  await page.getByLabel('Points for each player on the winning side', { exact: true }).fill('16');
  await page.getByLabel('Points for each player on the losing side', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Preview standings' }).click();
  await expect(page.locator('.chc-modal-dialog td')).toHaveCount(12);
  await expect(page.getByRole('button', { name: 'Confirm settlement' })).toBeEnabled();
  await page.getByLabel('Reason (required)', { exact: true }).fill('Revised retirement ruling');
  await expect(page.getByRole('button', { name: 'Confirm settlement' })).toBeDisabled();
  await page.getByRole('button', { name: 'Preview standings' }).click();
  await page.getByRole('button', { name: 'Confirm settlement' }).click();
  await expect(page.locator('.chc-modal-dialog')).toHaveCount(0);
  const saved = await page.evaluate(({ drawId }) => {
    const engine: any = dev.factory.tournamentEngine;
    return engine.getEvent({ drawId }).drawDefinition.competitionSettlements;
  }, ids);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    reason: 'Revised retirement ruling',
    recordedBy: 'Local director',
    treatment: { kind: 'CREDIT', winningPoints: 16, losingPoints: 8 },
  });
});

test('a changed result refuses the approved settlement and keeps the dialog open', async ({ page }) => {
  const ids = await prepare(page);
  await open(page, ids);
  await page.getByLabel('Reason (required)', { exact: true }).fill('Exclude retirement');
  await page.getByRole('button', { name: 'Preview standings' }).click();
  await page.evaluate(({ drawId, matchUpId }) => {
    const engine: any = dev.factory.tournamentEngine;
    const result = engine.executionQueue(
      [
        {
          method: 'setMatchUpStatus',
          params: {
            drawId,
            matchUpId,
            outcome: {
              matchUpStatus: 'RETIRED',
              winningSide: 1,
              score: { sets: [{ setNumber: 1, side1Score: 11, side2Score: 8 }] },
            },
          },
        },
      ],
      true,
    );
    if (result.error) throw new Error(result.error.message);
  }, ids);
  await page.getByRole('button', { name: 'Confirm settlement' }).click();
  await expect(page.locator('.chc-modal-dialog')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Confirm settlement' })).toBeDisabled();
  expect(
    await page.evaluate(({ drawId }) => {
      const engine: any = dev.factory.tournamentEngine;
      return engine.getEvent({ drawId }).drawDefinition.competitionSettlements ?? [];
    }, ids),
  ).toHaveLength(0);
});
