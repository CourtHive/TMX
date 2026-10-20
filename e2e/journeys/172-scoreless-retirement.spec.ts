import { initDevBridge, resetState } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

for (const reverseWinner of [false, true]) {
  test(`a scoreless retirement supports Clear then ${reverseWinner ? 'a propagated winner change' : 'a same-winner correction'}`, async ({
    page,
  }) => {
    await page.goto('/#/tournaments');
    await initDevBridge(page);
    await resetState(page);
    const seeded = await page.evaluate(async () => {
      globalThis.localStorage.clear();
      dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        completeAllMatchUps: true,
        tournamentAttributes: { tournamentId: 'e2e-scoreless-retirement' },
        drawProfiles: [{ drawSize: 4 }],
      });
      const matches = dev.factory.tournamentEngine.allTournamentMatchUps().matchUps;
      const target = matches.find((m: any) => m.roundNumber === 1 && m.roundPosition === 1);
      const next = matches.find((m: any) => m.roundNumber === 2);
      const { tournamentRecord } = dev.factory.tournamentEngine.getTournament();
      function retire(value: any): void {
        if (!value || typeof value !== 'object') return undefined;
        if (value.matchUpId === target.matchUpId) {
          value.matchUpStatus = 'RETIRED';
          value.score = { sets: [], scoreStringSide1: '', scoreStringSide2: '' };
          return undefined;
        }
        for (const child of Object.values(value)) retire(child);
      }
      retire(tournamentRecord);
      dev.factory.tournamentEngine.setState(tournamentRecord);
      await dev.tmx2db.addTournament(tournamentRecord);
      return {
        id: tournamentRecord.tournamentId,
        targetId: target.matchUpId,
        nextId: next.matchUpId,
        winner: target.winningSide,
        targetSides: target.sides.map((side: any) => side.participantId),
        nextSides: next.sides.map((side: any) => side.participantId),
        nextWinningSide: next.winningSide,
        nextScore: next.score,
      };
    });
    await page.goto(`/#/tournament/${seeded.id}/matchUps`);
    await initDevBridge(page);
    const score = page.locator('[tabulator-field="scoreDetail"] .scoreCell').filter({ hasText: /^RET$/ });
    await expect(score).toHaveCount(1);
    await score.click();
    await expect(page.locator('[data-action="clear"]')).toBeEnabled();
    await page.locator('[data-action="clear"]').click();
    await expect(page.locator('[data-action="submit"]')).toBeDisabled();
    const requestedWinner = reverseWinner ? 3 - seeded.winner : seeded.winner;
    for (const set of [1, 2]) {
      await page.locator(`input[data-side="1"][data-set="${set}"]`).fill(requestedWinner === 1 ? '6' : '3');
      await page.locator(`input[data-side="2"][data-set="${set}"]`).fill(requestedWinner === 2 ? '6' : '3');
    }
    await expect(page.locator('[data-action="submit"]')).toBeEnabled();
    await page.locator('[data-action="submit"]').click();
    await expect
      .poll(async () =>
        page.evaluate(
          (id) => dev.factory.tournamentEngine.q.matchUp({ matchUpId: id })?.matchUpStatus,
          seeded.targetId,
        ),
      )
      .toBe('COMPLETED');
    const after = await page.evaluate(
      ({ targetId, nextId }) => ({
        target: dev.factory.tournamentEngine.q.matchUp({ matchUpId: targetId }),
        next: dev.factory.tournamentEngine.q.matchUp({ matchUpId: nextId }),
      }),
      seeded,
    );
    expect(after.target.winningSide).toBe(requestedWinner);
    // Either way the next match keeps its result. A reversal swaps the new winner into the old winner's seat
    // there (the factory's swapWinnerLoser contract); a same-winner correction leaves its sides alone.
    expect(after.next.score).toEqual(seeded.nextScore);
    expect(after.next.matchUpStatus).toBe('COMPLETED');
    expect(after.next.winningSide).toBe(seeded.nextWinningSide);
    const oldWinner = seeded.targetSides[seeded.winner - 1];
    const newWinner = seeded.targetSides[requestedWinner - 1];
    const nextSides = after.next.sides.map((side: any) => side.participantId);
    expect(nextSides).toEqual(seeded.nextSides.map((id: string) => (id === oldWinner ? newWinner : id)));
  });
}
