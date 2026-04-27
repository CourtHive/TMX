/**
 * Panel for lucky draw round management.
 * Shows advancing winners (scrollable, informational) and eligible losers
 * (scrollable, row-selectable) with margin ratios for TD decision-making.
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

function clearSpans(row: Element) {
  row.querySelectorAll('span').forEach((s) => (s.style.color = ''));
}

function clearRowSelection(rows: NodeListOf<Element>) {
  rows.forEach((r) => {
    (r as HTMLElement).style.backgroundColor = '';
    (r as HTMLElement).style.color = '';
    clearSpans(r);
  });
}

function highlightRow(row: HTMLElement) {
  row.style.backgroundColor = SELECTED_BG;
  row.querySelectorAll('span').forEach((s) => (s.style.color = '#fff'));
}

function enableAdvanceButton(btn: HTMLButtonElement | null) {
  if (!btn) return;
  btn.disabled = false;
  btn.style.opacity = '1';
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
  const canAdvance = round.needsLuckySelection && losers.length > 0;

  // Winners list (read-only scrollable box, first ~5 visible)
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

  // Losers list (selectable rows)
  const losersHtml = losers.length
    ? losers
        .map((l: any, i: number) => {
          const ratios = [
            l.pointRatio != null ? `pts: ${formatRatio(l.pointRatio)}` : '',
            l.gameRatio != null ? `gm: ${formatRatio(l.gameRatio)}` : '',
            l.setRatio != null ? `set: ${formatRatio(l.setRatio)}` : '',
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
  const discardedCount = losers.length - 1; // all losers except the one selected

  const statusText = round.isComplete
    ? round.needsLuckySelection
      ? 'Round complete. Select a loser to advance.'
      : 'Round complete.'
    : `${round.completedCount} of ${round.matchUpsCount} matchUps complete.`;

  const consolidationInfo =
    canAdvance && consolidationLinks.length && discardedCount > 0
      ? `<div style="color: var(--tmx-panel-green-border, #48c774); font-size: 12px; margin-top: 6px; font-style: italic;">
          ${discardedCount} remaining loser${discardedCount > 1 ? 's' : ''} will be placed in the linked consolation structure.
        </div>`
      : '';

  const winnersMaxHeight = Math.min(winners.length, 5) * 34 + 4;

  const content = `
    <div style="color: var(--tmx-text-secondary, #666); font-size: 13px; margin-bottom: 12px;">
      ${statusText}
      ${consolidationInfo}
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
    </div>
  `;

  let selectedIndex: number | null = null;

  const advanceSelected = () => {
    if (selectedIndex == null) {
      tmxToast({ message: 'Select a loser to advance', intent: 'is-warning' });
      return;
    }

    const loser = losers[selectedIndex];
    if (!loser) return;

    mutationRequest({
      methods: [
        {
          method: LUCKY_DRAW_ADVANCEMENT,
          params: { participantId: loser.participantId, roundNumber, structureId, drawId },
        },
      ],
      callback: (mutationResult: any) => {
        closeModal();
        if (mutationResult?.error) {
          tmxToast({ message: mutationResult.error.message ?? 'Advancement failed', intent: 'is-danger' });
        } else {
          tmxToast({
            message: `${loser.participantName ?? 'Participant'} advanced to Round ${roundNumber + 1}`,
            intent: 'is-success',
          });
          callback({ refresh: true });
        }
      },
    });
  };

  const buttons = [
    { label: 'Cancel', intent: 'is-none', close: true },
    ...(canAdvance
      ? [
          {
            id: 'lucky-advance-btn',
            label: 'Advance Selected',
            intent: 'is-info',
            disabled: true,
            onClick: advanceSelected,
          },
        ]
      : []),
  ];

  openModal({
    title: `Lucky Draw — Round ${roundNumber}`,
    content,
    buttons,
    config: { padding: '.5', maxWidth: 650 },
  });

  // Wire up row selection on losers
  if (canAdvance) {
    setTimeout(() => {
      const advanceBtn = document.getElementById('lucky-advance-btn') as HTMLButtonElement;
      const rows = document.querySelectorAll('.lucky-loser-row');

      const onRowClick = (row: Element) => {
        const idx = Number.parseInt((row as HTMLElement).dataset.index || '');
        if (Number.isNaN(idx)) return;
        selectedIndex = idx;
        clearRowSelection(rows);
        highlightRow(row as HTMLElement);
        enableAdvanceButton(advanceBtn);
      };
      rows.forEach((row) => row.addEventListener('click', () => onRowClick(row)));
    }, 0);
  }
}
