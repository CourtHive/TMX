/**
 * Modal for selecting which loser advances in a lucky draw pre-feed round.
 * Shows eligible losers ranked by margin of defeat (narrowest first).
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, openModal } from './baseModal/baseModal';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';

import { LUCKY_DRAW_ADVANCEMENT } from 'constants/mutationConstants';

interface LuckyLoserSelectionParams {
  roundNumber: number;
  structureId: string;
  callback: (params?: any) => void;
  drawId: string;
}

export function luckyLoserSelection({ roundNumber, structureId, callback, drawId }: LuckyLoserSelectionParams) {
  const result = tournamentEngine.getLuckyDrawRoundStatus({ drawId });
  if (!result?.success || !result.isLuckyDraw) return;

  const round = result.rounds?.find((r: any) => r.roundNumber === roundNumber && r.needsLuckySelection);
  if (!round?.eligibleLosers?.length) {
    tmxToast({ message: 'No eligible losers for lucky advancement', intent: 'is-warning' });
    return;
  }

  const losers = round.eligibleLosers;

  const rows = losers
    .map((loser: any, index: number) => {
      const marginDisplay = Number.isFinite(loser.margin) ? (loser.margin * 100).toFixed(1) + '%' : 'N/A';
      const highlight = index === 0 ? "style='background: #f0f9ff;'" : '';
      return `
      <tr ${highlight} class="lucky-loser-row" data-participant-id="${loser.participantId}">
        <td style="padding: 8px 12px;">${index + 1}</td>
        <td style="padding: 8px 12px; font-weight: ${index === 0 ? '600' : '400'};">${loser.participantName || 'Unknown'}</td>
        <td style="padding: 8px 12px;">${loser.scoreString || '-'}</td>
        <td style="padding: 8px 12px; text-align: right;">${marginDisplay}</td>
        <td style="padding: 8px 12px; text-align: center;">${loser.setsWonByLoser ?? 0}</td>
        <td style="padding: 8px 12px; text-align: center;">
          <button class="lucky-select-btn" data-participant-id="${loser.participantId}"
            style="padding: 4px 12px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; cursor: pointer;">
            Select
          </button>
        </td>
      </tr>`;
    })
    .join('');

  const content = `
    <div style="margin-bottom: 12px; color: #666; font-size: 13px;">
      Round ${roundNumber} has an odd number of matchUps. One loser advances to the next round.
      Losers are ranked by margin of defeat (narrowest first).
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 2px solid #e5e7eb; text-align: left;">
          <th style="padding: 8px 12px;">#</th>
          <th style="padding: 8px 12px;">Participant</th>
          <th style="padding: 8px 12px;">Score</th>
          <th style="padding: 8px 12px; text-align: right;">Margin</th>
          <th style="padding: 8px 12px; text-align: center;">Sets Won</th>
          <th style="padding: 8px 12px; text-align: center;"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const advanceLoser = (participantId: string) => {
    const methods = [
      {
        method: LUCKY_DRAW_ADVANCEMENT,
        params: { participantId, roundNumber, structureId, drawId },
      },
    ];

    mutationRequest({
      methods,
      callback: (mutationResult: any) => {
        closeModal();
        if (mutationResult?.error) {
          tmxToast({ message: mutationResult.error.message ?? 'Advancement failed', intent: 'is-danger' });
        } else {
          const name = losers.find((l: any) => l.participantId === participantId)?.participantName ?? 'Participant';
          tmxToast({ message: `${name} advanced to Round ${roundNumber + 1}`, intent: 'is-success' });
          callback({ refresh: true });
        }
      },
    });
  };

  const buttons = [{ label: 'Cancel', intent: 'is-none', close: true }];

  openModal({
    title: `Lucky Draw — Round ${roundNumber} Advancement`,
    content,
    buttons,
    config: { padding: '.5', maxWidth: 700 },
  });

  // Attach click handlers to select buttons
  setTimeout(() => {
    document.querySelectorAll('.lucky-select-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const participantId = (e.currentTarget as HTMLElement).getAttribute('data-participant-id');
        if (participantId) advanceLoser(participantId);
      });
    });
  }, 0);
}
