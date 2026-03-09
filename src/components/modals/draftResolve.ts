/**
 * Resolve Draft modal.
 * TD interface for previewing draft resolution and applying placements.
 * Shows tier-by-tier breakdown with transparency report.
 */
import { renderEventsTab } from 'pages/tournament/tabs/eventsTab/eventsTab';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from './baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'tods-competition-factory';

import { RESOLVE_DRAFT_POSITIONS } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

const TH_STYLE = 'text-align: left; padding: 4px 8px; font-size: 12px; color: var(--tmx-text-secondary, #666); border-bottom: 2px solid var(--tmx-border-secondary, #ddd);';
const TD_STYLE = 'padding: 4px 8px; font-size: 13px; border-bottom: 1px solid var(--tmx-border-secondary, #eee);';
interface ResolveDraftParams {
  drawId: string;
  eventId: string;
}

export function openResolveDraft({ drawId, eventId }: ResolveDraftParams): void {
  const { draftState, summary, error } = tournamentEngine.getDraftState({ drawId }) as any;

  if (error || !draftState) {
    tmxToast({ message: 'No draft found for this draw', intent: 'is-warning' });
    return;
  }

  if (draftState.status === 'COMPLETE') {
    tmxToast({ message: 'Draft has already been resolved', intent: 'is-info' });
    return;
  }

  const participants = getParticipantsMap();

  const statusLabel = getStatusLabel(draftState.status);
  const outstandingWarning =
    summary.preferencesOutstanding > 0
      ? `<div style="color: var(--tmx-panel-amber-text, #946200); font-size: 12px; margin-top: 4px; padding: 4px 8px; background: var(--tmx-panel-amber-bg, #fff8e1); border-radius: 3px;">
          ${summary.preferencesOutstanding} participant${summary.preferencesOutstanding > 1 ? 's have' : ' has'} not submitted preferences and will be placed randomly.
        </div>`
      : '';

  const content = `
    <div style="font-size: 0.9em; overflow: hidden;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 10px;">
        <div>Status: <strong>${statusLabel}</strong></div>
        <div>Tiers: <strong>${summary.tiersTotal}</strong></div>
        <div>Preferences: <strong>${summary.preferencesSubmitted} / ${summary.totalParticipants}</strong></div>
        <div>Max per participant: <strong>${draftState.preferencesCount ?? 3}</strong></div>
      </div>
      ${outstandingWarning}
      <div id="draft-preview-area" style="margin-top: 12px;">
        <div style="color: var(--tmx-text-muted, #999); font-size: 13px; font-style: italic; padding: 16px; text-align: center;">
          Click Preview to see proposed placements before resolving.
        </div>
      </div>
    </div>
  `;

  const previewDraft = () => {
    const result = tournamentEngine.resolveDraftPositions({ drawId, applyResults: false }) as any;
    if (result.error) {
      tmxToast({ message: result.error?.message || 'Preview failed', intent: 'is-warning' });
      return;
    }

    const area = document.getElementById('draft-preview-area');
    if (!area) return;

    const report = result.transparencyReport || [];
    const tiers = draftState.tiers || [];

    // Build tier-grouped report
    let html = '';
    let offset = 0;

    for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
      const tier = tiers[tierIdx];
      const count = tier.participantIds?.length || 0;
      const tierEntries = report.slice(offset, offset + count);
      offset += count;

      // Stats for this tier
      const gotFirst = tierEntries.filter((e: any) => e.preferenceMatch === 1).length;
      const gotPref = tierEntries.filter((e: any) => e.preferenceMatch != null).length;
      const random = tierEntries.filter((e: any) => e.preferenceMatch == null).length;

      html += `<div style="margin-bottom: 8px;">`;
      html += `<div style="display: flex; align-items: center; gap: 8px; padding: 4px 0; margin-bottom: 2px;">`;
      html += `<strong style="font-size: 13px;">Tier ${tierIdx + 1}</strong>`;
      html += `<span style="font-size: 11px; color: var(--tmx-text-secondary, #666);">${gotFirst} 1st choice · ${gotPref} got preference · ${random} random</span>`;
      html += `</div>`;

      html += `<table style="width: 100%; border-collapse: collapse;">`;
      html += `<tr><th style="${TH_STYLE}">Participant</th><th style="${TH_STYLE}">Position</th><th style="${TH_STYLE}">Result</th><th style="${TH_STYLE}">Preferences</th></tr>`;

      for (const entry of tierEntries) {
        const name = participants.get(entry.participantId) || entry.participantId.slice(0, 8);
        const pos = entry.assignedPosition ?? '—';
        const matchLabel = getMatchLabel(entry.preferenceMatch);
        const matchColor = getMatchColor(entry.preferenceMatch);
        const prefsDisplay = entry.preferences?.length ? entry.preferences.join(', ') : '<span style="color: var(--tmx-text-muted, #999);">none</span>';

        html += `<tr>`;
        html += `<td style="${TD_STYLE}">${name}</td>`;
        html += `<td style="${TD_STYLE} font-weight: 600;">${pos}</td>`;
        html += `<td style="${TD_STYLE}"><span style="color: ${matchColor}; font-weight: 500;">${matchLabel}</span></td>`;
        html += `<td style="${TD_STYLE} font-size: 12px; color: var(--tmx-text-secondary, #666);">${prefsDisplay}</td>`;
        html += `</tr>`;
      }

      html += `</table></div>`;
    }

    area.innerHTML = `
      <div style="max-height: 350px; overflow-y: auto; border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 4px; padding: 8px;">
        ${html}
      </div>
    `;

    // Enable resolve button
    const resolveBtn = document.getElementById('draft-resolve-btn') as HTMLButtonElement;
    if (resolveBtn) {
      resolveBtn.disabled = false;
      resolveBtn.style.opacity = '1';
    }
  };

  const resolveDraft = () => {
    mutationRequest({
      methods: [{ method: RESOLVE_DRAFT_POSITIONS, params: { drawId, eventId } }],
      callback: (result: any) => {
        if (result.success) {
          tmxToast({ message: 'Draft resolved — participants placed', intent: 'is-success' });
          renderEventsTab({ eventId, drawId, renderDraw: true });
        } else {
          tmxToast({ message: result.error?.message || 'Failed to resolve draft', intent: 'is-danger' });
        }
      },
    });
  };

  openModal({
    title: 'Resolve Draft',
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Preview', intent: 'is-info', onClick: previewDraft },
      {
        id: 'draft-resolve-btn',
        label: 'Resolve & Place',
        intent: 'is-success',
        close: true,
        onClick: resolveDraft,
        disabled: true,
      },
    ],
    config: { padding: '.5', maxWidth: 750 },
  });
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    INITIALIZED: 'Initialized',
    SEEDS_PLACED: 'Seeds placed',
    COLLECTING_PREFERENCES: 'Collecting preferences',
    COMPLETE: 'Complete',
  };
  return labels[status] || status;
}

function getMatchLabel(preferenceMatch: number | null): string {
  if (preferenceMatch == null) return 'Random';
  return `${ordinal(preferenceMatch)} choice`;
}

function getMatchColor(preferenceMatch: number | null): string {
  if (preferenceMatch == null) return 'var(--tmx-text-muted, #999)';
  if (preferenceMatch === 1) return 'var(--tmx-panel-green-border, #48c774)';
  if (preferenceMatch === 2) return 'var(--tmx-accent-teal, #00b8a9)';
  return 'var(--tmx-text-secondary, #666)';
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getParticipantsMap(): Map<string, string> {
  const { participants } = tournamentEngine.getParticipants() as any;
  const map = new Map<string, string>();
  for (const p of participants || []) {
    map.set(p.participantId, p.participantName);
  }
  return map;
}
