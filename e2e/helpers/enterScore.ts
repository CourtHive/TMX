import type { Page } from '@playwright/test';

export interface EnterScoreParams {
  matchUpId: string;
  drawId: string;
  /** Score string parsed by the factory, e.g. '6-2 6-3'. Omit for a status-only outcome. */
  scoreString?: string;
  /** Winning side. Default 1. */
  winningSide?: 1 | 2;
  /** matchUp status. Default 'COMPLETED'. */
  matchUpStatus?: string;
  /** Fire context.refreshActiveTable after apply (as the scoring modal callback does),
   *  so a mounted grid/table re-renders. Default false. */
  refreshActive?: boolean;
}

/**
 * The single score-entry ability for TMX e2e.
 *
 * The scoring MODAL is covered in courthive-components, so TMX e2e does NOT drive
 * it — this helper exists so other TMX journeys can set up scored state (winner
 * advancement, round-robin standings, reports, grid refresh, matchUps-table
 * badges…) without clicking through the modal. It submits the exact
 * `setMatchUpStatus` outcome the modal builds (with `allowChangePropagation` so
 * winners advance), through the real `dev.mutationRequest` bridge — mirroring
 * `src/services/transitions/scoreMatchUp.ts`. Resolves once the mutation applies.
 */
export async function enterScore(page: Page, params: EnterScoreParams): Promise<void> {
  await page.evaluate(async (p) => {
    const sets = p.scoreString
      ? dev.factory.tournamentEngine.parseScoreString({ scoreString: p.scoreString }) || []
      : [];
    await new Promise<void>((resolve) => {
      dev.mutationRequest({
        methods: [
          {
            method: 'setMatchUpStatus',
            params: {
              allowChangePropagation: true,
              drawId: p.drawId,
              outcome: {
                score: { sets },
                matchUpStatus: p.matchUpStatus ?? 'COMPLETED',
                winningSide: p.winningSide ?? 1,
              },
              matchUpId: p.matchUpId,
            },
          },
        ],
        callback: () => {
          if (p.refreshActive) dev.tournamentContext.refreshActiveTable?.();
          resolve();
        },
      });
    });
  }, params);
}
