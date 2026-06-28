/**
 * Panel for lucky draw round management.
 * Shows advancing winners (scrollable, informational) and eligible losers
 * (scrollable, row-selectable) with margin ratios for TD decision-making.
 *
 * Supports both single-LL (default LUCKY_DRAW ceil-halving cascade) and
 * multi-LL (LUCKY_DRAW with an explicit roundProfile whose transitions
 * demand more than one LL). The required count comes from
 * `round.requiredLuckyLoserCount`; for N=1 the UX is identical to the
 * single-select original. For N>1 the user selects exactly N losers and
 * the modal submits `participantIds: string[]`.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, openModal } from './baseModal/baseModal';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';

import { LUCKY_DRAW_ADVANCEMENT } from 'constants/mutationConstants';

interface LuckyLoserSelectionParams {
  roundNumber: number;
  structureId: string;
  callback: (params?: any) => void;
  drawId: string;
}

function clearSpans(row: Element) {
  row.querySelectorAll('span').forEach((s) => (s.style.color = ''));
}

function clearRow(row: HTMLElement) {
  row.style.backgroundColor = '';
  row.style.color = '';
  clearSpans(row);
}

function highlightRow(row: HTMLElement) {
  row.style.backgroundColor = SELECTED_BG;
  row.querySelectorAll('span').forEach((s) => (s.style.color = '#fff'));
}

function formatRatio(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return (value * 100).toFixed(1) + '%';
}

const ROW_STYLE =
  'display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--tmx-border-secondary, #eee);';
const SELECTED_BG = 'var(--tmx-accent-teal, #00b8a9)';

export function luckyLoserSelection({ roundNumber, structureId, callback, drawId }: LuckyLoserSelectionParams) {
  const result = tournamentEngine.getLuckyDrawRoundStatus({ drawId, structureId });
  if (!result?.success || !result.isLuckyDraw) return;

  const round = result.rounds?.find((r: any) => r.roundNumber === roundNumber && r.isPreFeedRound);
  if (!round) return;

  const winners = round.advancingWinners || [];
  const losers = round.eligibleLosers || [];
  // LUCKY_DRAW with an explicit roundProfile may require >1 LL per transition;
  // the default ceil-halving cascade falls back to 1.
  const requiredCount = Math.max(1, round.requiredLuckyLoserCount ?? 1);
  const canAdvance = round.needsLuckySelection && losers.length >= requiredCount;

  const winnersHtml = winners.length
    ? winners
        .map(
          (w: any) =>
            `<div style="${ROW_STYLE} color: var(--tmx-text-primary, #363636);">
              <span style="flex: 1;">${w.participantName || 'Unknown'}</span>
              <span style="color: var(--tmx-text-secondary, #666); font-size: 13px; white-space: nowrap;">${w.scoreString || ''}</span>
            </div>`,
        )
        .join('')
    : '<div style="color: var(--tmx-text-muted, #999); padding: 8px;">No winners yet</div>';

  const losersHtml = losers.length
    ? losers
        .map((l: any, i: number) => {
          const ratios = [
            l.pointRatio == null ? '' : `pts: ${formatRatio(l.pointRatio)}`,
            l.gameRatio == null ? '' : `gm: ${formatRatio(l.gameRatio)}`,
            l.setRatio == null ? '' : `set: ${formatRatio(l.setRatio)}`,
          ]
            .filter(Boolean)
            .join('  ');

          return `<div class="lucky-loser-row" data-index="${i}"
            style="${ROW_STYLE} cursor: ${canAdvance ? 'pointer' : 'default'}; border-radius: 3px; transition: background-color 0.15s;">
            <span style="flex: 1; color: var(--tmx-text-primary, #363636);">${l.participantName || 'Unknown'}</span>
            <span style="color: var(--tmx-text-secondary, #666); font-size: 13px; white-space: nowrap;">${l.scoreString || ''}</span>
            <span style="color: #2979ff; font-size: 12px; font-weight: 600; font-family: monospace; white-space: nowrap; min-width: 120px; text-align: right;">${ratios}</span>
          </div>`;
        })
        .join('')
    : '<div style="color: var(--tmx-text-muted, #999); padding: 8px;">No completed matchUps with losers yet.</div>';

  const consolidationLinks = round.consolidationLinks || [];

  const selectionPrompt =
    requiredCount === 1
      ? 'Select a loser to advance.'
      : `Select ${requiredCount} losers to advance.`;

  const statusText = round.isComplete
    ? round.needsLuckySelection
      ? `Round complete. ${selectionPrompt}`
      : 'Round complete.'
    : `${round.completedCount} of ${round.matchUpsCount} matchUps complete.`;

  const counterId = 'lucky-loser-counter';
  const counterHtml = canAdvance
    ? `<div id="${counterId}" style="color: var(--tmx-text-secondary, #666); font-size: 12px; margin-top: 4px;">
         Selected: <strong>0</strong> / ${requiredCount}
       </div>`
    : '';

  const winnersMaxHeight = Math.min(winners.length, 5) * 34 + 4;

  const content = `
    <div style="color: var(--tmx-text-secondary, #666); font-size: 13px; margin-bottom: 12px;">
      ${statusText}
      <div id="lucky-loser-consolidation-info" style="color: var(--tmx-panel-green-border, #48c774); font-size: 12px; margin-top: 6px; font-style: italic;"></div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-weight: 600; color: var(--tmx-text-secondary, #666); margin-bottom: 4px;">Advancing Winners (${winners.length})</div>
      <div style="max-height: ${winnersMaxHeight}px; overflow-y: auto; border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 4px;">
        ${winnersHtml}
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: var(--tmx-text-secondary, #666); margin-bottom: 4px;">Losers &mdash; by margin (${losers.length})</div>
      <div id="lucky-losers-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 4px;">
        ${losersHtml}
      </div>
      ${counterHtml}
    </div>
  `;

  const selectedIndices = new Set<number>();
  let modalHandle: any;

  const advanceSelected = () => {
    if (selectedIndices.size !== requiredCount) {
      tmxToast({
        message: `Select exactly ${requiredCount} loser${requiredCount === 1 ? '' : 's'} to advance`,
        intent: 'is-warning',
      });
      return;
    }

    // Preserve margin-rank order when submitting (eligibleLosers is sorted by
    // narrowest margin first; selectedIndices reflects display order).
    const selectedLosers = [...selectedIndices].sort((a, b) => a - b).map((i) => losers[i]);
    const participantIds = selectedLosers.map((l: any) => l.participantId);

    mutationRequest({
      methods: [
        {
          method: LUCKY_DRAW_ADVANCEMENT,
          params: { participantIds, roundNumber, structureId, drawId },
        },
      ],
      callback: (mutationResult: any) => {
        closeModal();
        if (mutationResult?.error) {
          tmxToast({ message: mutationResult.error.message ?? 'Advancement failed', intent: 'is-danger' });
        } else {
          const names = selectedLosers.map((l: any) => l.participantName ?? 'Participant').join(', ');
          tmxToast({
            message: `${names} advanced to Round ${roundNumber + 1}`,
            intent: 'is-success',
          });
          callback({ refresh: true });
        }
      },
    });
  };

  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    ...(canAdvance
      ? [
          {
            id: 'lucky-advance-btn',
            label: requiredCount === 1 ? 'Advance Selected' : `Advance ${requiredCount} Selected`,
            intent: 'is-info',
            disabled: true,
            onClick: advanceSelected,
          },
        ]
      : []),
  ];

  modalHandle = openModal({
    title: `Lucky Draw — Round ${roundNumber}`,
    content,
    buttons,
    config: { padding: '.5', maxWidth: 650 },
  });

  if (canAdvance) {
    setTimeout(() => {
      const rows = document.querySelectorAll<HTMLElement>('.lucky-loser-row');
      const counter = document.getElementById(counterId);
      const consolidationInfo = document.getElementById('lucky-loser-consolidation-info');

      const updateUI = () => {
        rows.forEach((row) => {
          const idx = Number.parseInt(row.dataset.index || '');
          if (selectedIndices.has(idx)) highlightRow(row);
          else clearRow(row);
        });

        if (counter) {
          counter.innerHTML = `Selected: <strong>${selectedIndices.size}</strong> / ${requiredCount}`;
        }

        const discardedCount = losers.length - selectedIndices.size;
        if (consolidationInfo) {
          if (selectedIndices.size === requiredCount && consolidationLinks.length && discardedCount > 0) {
            consolidationInfo.textContent = `${discardedCount} remaining loser${discardedCount > 1 ? 's' : ''} will be placed in the linked consolation structure.`;
          } else {
            consolidationInfo.textContent = '';
          }
        }

        modalHandle?.setButtonState('lucky-advance-btn', {
          disabled: selectedIndices.size !== requiredCount,
        });
      };

      rows.forEach((row) => {
        row.addEventListener('click', () => {
          const idx = Number.parseInt(row.dataset.index || '');
          if (Number.isNaN(idx)) return;

          if (selectedIndices.has(idx)) {
            selectedIndices.delete(idx);
          } else if (selectedIndices.size < requiredCount) {
            selectedIndices.add(idx);
          } else if (requiredCount === 1) {
            // Single-LL mode: clicking a different row replaces selection.
            selectedIndices.clear();
            selectedIndices.add(idx);
          } else {
            // Multi-LL at cap: ignore further additions (user must deselect first).
            tmxToast({
              message: `Already at ${requiredCount} selected — deselect one to choose another`,
              intent: 'is-warning',
            });
            return;
          }
          updateUI();
        });
      });

      updateUI();
    }, 0);
  }
}
