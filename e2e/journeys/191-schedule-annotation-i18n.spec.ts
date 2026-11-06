import { initDevBridge, resetState } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';
import { todayLocal } from '../helpers/dates';

const ID = 'e2e-schedule-annotation-i18n';
const DATE = todayLocal();

test('the live grid supplies compact labels and full descriptions for every schedule annotation', async ({ page }) => {
  await page.goto('/#/tournaments');
  await initDevBridge(page);
  await resetState(page);
  const matches = await page.evaluate(
    async ({ id, date }) => {
      dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        startDate: date,
        endDate: date,
        tournamentAttributes: { tournamentId: id },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Annotation labels', drawSize: 16 }],
        venueProfiles: [{ courtsCount: 1 }],
      });
      const te = dev.factory.tournamentEngine;
      const court = te.getVenuesAndCourts().venues[0].courts[0];
      const firstRound = te.allTournamentMatchUps().matchUps.filter((m: any) => m.roundNumber === 1);
      const modifiers = ['NOT_BEFORE', 'FOLLOWED_BY', 'NEXT_AVAILABLE', 'AFTER_REST', 'TO_BE_ANNOUNCED', 'RAIN_DELAY'];
      const matches = modifiers.map((modifier, index) => {
        const matchUp = firstRound[index];
        const result = te.addMatchUpScheduleItems({
          matchUpId: matchUp.matchUpId,
          drawId: matchUp.drawId,
          schedule: {
            scheduledDate: date,
            courtId: court.courtId,
            venueId: court.venueId,
            courtOrder: index + 1,
            timeModifiers: [modifier],
            ...(modifier === 'NOT_BEFORE' ? { scheduledTime: '11:00' } : {}),
          },
        });
        if (!result.success) throw new Error(JSON.stringify(result));
        return { modifier, matchUpId: matchUp.matchUpId };
      });
      await dev.tmx2db.addTournament(te.getTournament().tournamentRecord);
      return matches;
    },
    { id: ID, date: DATE },
  );
  await page.goto(`/#/tournament/${ID}/scheduling/${DATE}/grid`);
  await initDevBridge(page);
  const compact = ['NB 11:00', 'Followed by', 'Next available', 'After rest', 'TBA', 'Rain delay'];
  const full = ['Not Before · 11:00', 'Followed by', 'Next available', 'After rest', 'To be announced', 'Rain delay'];
  for (const [index, { modifier, matchUpId }] of matches.entries()) {
    // Distinguish the scheduled grid copy from the Now strip's copy of the same matchUp.
    const label = page.locator(`[data-court-order][data-matchup-id="${matchUpId}"] .spl-grid-cell__time`);
    await expect(label).toHaveText(compact[index]);
    await expect(label).toHaveAttribute('title', full[index]);
    await expect(label).toHaveAccessibleName(full[index]);
    await expect(label).not.toContainText(modifier);
  }
});
