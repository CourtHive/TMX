/**
 * Configure Draft modal.
 * TD interface for managing draft tiers, preferences count, and entering
 * preferences on behalf of participants.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, openModal } from './baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'tods-competition-factory';

import { INITIALIZE_DRAFT, RESOLVE_DRAFT_POSITIONS, SET_DRAW_POSITION_PREFERENCES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

const ROW_STYLE =
  'display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-bottom: 1px solid var(--tmx-border-secondary, #eee); cursor: pointer; transition: background-color 0.15s;';
const TIER_HEADER =
  'font-weight: 600; font-size: 13px; color: var(--tmx-text-secondary, #666); padding: 6px 8px; background: var(--tmx-bg-secondary, #f5f5f5); border-bottom: 1px solid var(--tmx-border-secondary, #eee);';

interface ConfigureDraftParams {
  drawId: string;
  eventId: string;
  callback?: () => void;
}

export function openConfigureDraft({ drawId, eventId, callback }: ConfigureDraftParams): void {
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
  const availablePositions = draftState.unassignedDrawPositions || [];
  const anyTierResolved = draftState.tiers?.some((t: any) => t.resolved);

  const configBar = anyTierResolved
    ? ''
    : `<div style="display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--tmx-border-secondary, #eee);">
        <label style="display: flex; align-items: center; gap: 6px; color: var(--tmx-text-primary, #363636);">
          Tiers:
          <select id="draft-tier-count" style="padding: 2px 6px; border-radius: 3px; border: 1px solid var(--tmx-border-secondary, #ccc); background: var(--tmx-bg-elevated, #fff); color: var(--tmx-text-primary, #363636);">
            ${tierCountOptions(summary.totalParticipants, summary.tiersTotal)}
          </select>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; color: var(--tmx-text-primary, #363636);">
          Max preferences:
          <select id="draft-pref-count" style="padding: 2px 6px; border-radius: 3px; border: 1px solid var(--tmx-border-secondary, #ccc); background: var(--tmx-bg-elevated, #fff); color: var(--tmx-text-primary, #363636);">
            ${prefCountOptions(availablePositions.length, draftState.preferencesCount ?? 3)}
          </select>
        </label>
        <button id="draft-reconfigure-btn" disabled style="padding: 3px 10px; font-size: 12px; border-radius: 3px; border: 1px solid var(--tmx-border-secondary, #ccc); background: var(--tmx-accent-teal, #00b8a9); color: #fff; cursor: pointer; font-weight: 500; opacity: 0.4;">
          Apply
        </button>
        <span style="flex: 1; min-width: 0;"></span>
      </div>`;

  const content = `
    <div style="font-size: 0.9em; overflow: hidden;">
      ${configBar}

      <div style="display: flex; gap: 12px; margin-bottom: 12px;">
        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 12px; background: var(--tmx-panel-blue-bg, #e8f4fd); color: var(--tmx-panel-blue-text, #1a73e8);">
          ${availablePositions.length} available position${availablePositions.length !== 1 ? 's' : ''}
        </span>
        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 12px; background: ${summary.preferencesSubmitted === summary.totalParticipants ? '#1b5e20' : '#e65100'}; color: #fff;">
          ${summary.preferencesSubmitted} of ${summary.totalParticipants} submitted
        </span>
      </div>

      <div id="draft-tiers-container" style="max-height: 350px; overflow-y: auto; border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 4px;">
        ${renderTiers(draftState, participants)}
      </div>
    </div>
  `;

  openModal({
    title: 'Configure Draft',
    content,
    buttons: [{ label: 'Done', intent: 'is-primary', close: true }],
    config: { padding: '.5', maxWidth: 700 },
  });

  // Wire up interactions after DOM is ready
  setTimeout(() => {
    const reconfigBtn = document.getElementById('draft-reconfigure-btn') as HTMLButtonElement;
    const tierSelect = document.getElementById('draft-tier-count') as HTMLSelectElement;
    const prefSelect = document.getElementById('draft-pref-count') as HTMLSelectElement;

    const currentTierCount = summary.tiersTotal;
    const currentPrefCount = draftState.preferencesCount ?? 3;

    // Enable Apply only when dropdown values differ from current state
    const updateApplyState = () => {
      const changed =
        parseInt(tierSelect?.value) !== currentTierCount || parseInt(prefSelect?.value) !== currentPrefCount;
      if (reconfigBtn) {
        reconfigBtn.disabled = !changed;
        reconfigBtn.style.opacity = changed ? '1' : '0.4';
      }
    };

    tierSelect?.addEventListener('change', updateApplyState);
    prefSelect?.addEventListener('change', updateApplyState);

    // Reconfigure button — re-initializes draft with new tier/pref counts
    reconfigBtn?.addEventListener('click', () => {
      const newTierCount = parseInt(tierSelect?.value || '3');
      const newPrefCount = parseInt(prefSelect?.value || '3');

      if (newTierCount === currentTierCount && newPrefCount === currentPrefCount) return;

      mutationRequest({
        methods: [
          {
            method: INITIALIZE_DRAFT,
            params: { drawId, eventId, tierCount: newTierCount, preferencesCount: newPrefCount, force: true },
          },
        ],
        callback: (result: any) => {
          if (result.success) {
            closeModal();
            openConfigureDraft({ drawId, eventId, callback });
          } else {
            tmxToast({ message: result.error?.message || 'Reconfigure failed', intent: 'is-warning' });
          }
        },
      });
    });

    // Participant row clicks — open preference entry (only for unresolved tiers)
    const rows = document.querySelectorAll('.draft-participant-clickable');
    rows.forEach((row) => {
      row.addEventListener('click', () => {
        const participantId = (row as HTMLElement).dataset.participantId;
        if (participantId) {
          openPreferenceEntry({ drawId, eventId, participantId, draftState, participants, callback });
        }
      });
    });

    // Resolve tier buttons
    const resolveBtns = document.querySelectorAll('.draft-resolve-tier-btn');
    resolveBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tierIndex = parseInt((btn as HTMLElement).dataset.tierIndex || '');
        if (isNaN(tierIndex)) return;

        mutationRequest({
          methods: [
            {
              method: RESOLVE_DRAFT_POSITIONS,
              params: { drawId, eventId, tierIndex },
            },
          ],
          callback: (result: any) => {
            if (result.success) {
              tmxToast({ message: `Tier ${tierIndex + 1} resolved`, intent: 'is-success' });
              closeModal();
              openConfigureDraft({ drawId, eventId, callback });
            } else {
              tmxToast({ message: result.error?.message || 'Failed to resolve tier', intent: 'is-warning' });
            }
          },
        });
      });
    });
  }, 0);
}

/**
 * Sub-modal: preference entry for a single participant.
 * TD clicks available positions to rank them as preferences.
 */
function openPreferenceEntry({
  drawId,
  eventId,
  participantId,
  draftState,
  participants,
  callback,
}: {
  drawId: string;
  eventId: string;
  participantId: string;
  draftState: any;
  participants: Map<string, string>;
  callback?: () => void;
}): void {
  const name = participants.get(participantId) || participantId.slice(0, 8);
  const maxPrefs = draftState.preferencesCount ?? 3;
  const available = draftState.unassignedDrawPositions || [];
  const existing = draftState.preferences[participantId] || [];

  let selected: number[] = [...existing];

  const renderPositionGrid = () => {
    return available
      .map((pos: number) => {
        const idx = selected.indexOf(pos);
        const isSelected = idx >= 0;
        const rank = idx + 1;
        const bg = isSelected ? 'var(--tmx-accent-teal, #00b8a9)' : 'var(--tmx-bg-secondary, #f5f5f5)';
        const color = isSelected ? '#fff' : 'var(--tmx-text-primary, #363636)';
        const badge = isSelected ? `<span style="position:absolute;top:-2px;right:-2px;background:#e74c3c;color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;">${rank}</span>` : '';

        return `<div class="draft-pos-btn" data-position="${pos}" style="position:relative; display:inline-flex; align-items:center; justify-content:center; min-width:36px; height:36px; padding:4px 8px; margin:3px; border-radius:4px; border:1px solid var(--tmx-border-secondary, #ccc); background:${bg}; color:${color}; cursor:pointer; font-size:14px; font-weight:600; transition: all 0.15s;">${pos}${badge}</div>`;
      })
      .join('');
  };

  const updateGrid = () => {
    const container = document.getElementById('pref-positions-grid');
    if (container) container.innerHTML = renderPositionGrid();
    wirePositionClicks();

    const summary = document.getElementById('pref-selection-summary');
    if (summary) {
      summary.textContent = selected.length
        ? `Selected: ${selected.join(' → ')} (${selected.length}/${maxPrefs})`
        : `Click positions to rank preferences (max ${maxPrefs})`;
    }
  };

  const wirePositionClicks = () => {
    const btns = document.querySelectorAll('.draft-pos-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const pos = parseInt((btn as HTMLElement).dataset.position || '');
        if (isNaN(pos)) return;

        const existingIdx = selected.indexOf(pos);
        if (existingIdx >= 0) {
          // deselect
          selected.splice(existingIdx, 1);
        } else if (selected.length < maxPrefs) {
          // add to end
          selected.push(pos);
        }
        updateGrid();
      });
    });
  };

  const savePreferences = () => {
    mutationRequest({
      methods: [
        {
          method: SET_DRAW_POSITION_PREFERENCES,
          params: { drawId, eventId, participantId, preferences: selected },
        },
      ],
      callback: (result: any) => {
        if (result.success) {
          closeModal();
          // Re-open configure modal to show updated state
          openConfigureDraft({ drawId, eventId, callback });
        } else {
          tmxToast({ message: result.error?.message || 'Failed to save preferences', intent: 'is-warning' });
        }
      },
    });
  };

  const clearPreferences = () => {
    selected = [];
    updateGrid();
  };

  const contentHtml = `
    <div style="font-size: 0.9em; overflow: hidden;">
      <div style="margin-bottom: 10px; color: var(--tmx-text-secondary, #666); font-size: 13px;">
        Click draw positions in order of preference for <strong>${name}</strong>.
      </div>
      <div id="pref-selection-summary" style="margin-bottom: 10px; font-size: 13px; color: var(--tmx-text-secondary, #666);">
        ${existing.length ? `Current: ${existing.join(' → ')}` : `Click positions to rank preferences (max ${maxPrefs})`}
      </div>
      <div id="pref-positions-grid" style="display: flex; flex-wrap: wrap; padding: 8px; border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 4px; max-height: 250px; overflow: auto;">
        ${renderPositionGrid()}
      </div>
    </div>
  `;

  openModal({
    title: `Preferences — ${name}`,
    content: contentHtml,
    buttons: [
      {
        label: 'Cancel',
        intent: NONE,
        onClick: () => {
          closeModal();
          setTimeout(() => openConfigureDraft({ drawId, eventId, callback }), 0);
        },
      },
      { label: 'Clear', intent: 'is-warning', onClick: clearPreferences },
      { label: 'Save', intent: 'is-success', onClick: savePreferences },
    ],
    config: { padding: '.5', maxWidth: 500 },
  });

  setTimeout(() => wirePositionClicks(), 0);
}

function renderTiers(draftState: any, participants: Map<string, string>): string {
  const tiers = draftState.tiers || [];
  const preferences = draftState.preferences || {};

  return tiers
    .map((tier: any, tierIdx: number) => {
      const totalCount = tier.participantIds?.length || 0;
      const submittedCount = (tier.participantIds || []).filter((pid: string) => preferences[pid]?.length).length;
      const allSubmitted = submittedCount === totalCount;
      const previousResolved = tierIdx === 0 || draftState.tiers.slice(0, tierIdx).every((t: any) => t.resolved);
      const canResolve = !tier.resolved && allSubmitted && previousResolved;

      const participantRows = (tier.participantIds || [])
        .map((pid: string) => {
          const name = participants.get(pid) || pid.slice(0, 8);
          const prefs = preferences[pid];
          const prefDisplay = prefs?.length
            ? `<span style="color: var(--tmx-accent-teal, #00b8a9); font-size: 12px;">${prefs.join(', ')}</span>`
            : `<span style="color: var(--tmx-text-muted, #999); font-size: 12px; font-style: italic;">none</span>`;

          const rowOpacity = tier.resolved ? 'opacity: 0.6;' : '';
          const clickable = tier.resolved ? 'cursor: default;' : 'cursor: pointer;';

          return `<div class="draft-participant-row${tier.resolved ? '' : ' draft-participant-clickable'}" data-participant-id="${pid}" style="${ROW_STYLE} ${rowOpacity} ${clickable}">
            <span style="flex: 1; color: var(--tmx-text-primary, #363636);">${name}</span>
            <span style="display: flex; align-items: center;">${prefDisplay}</span>
            ${tier.resolved ? '' : '<i class="fa-solid fa-pencil" style="font-size: 11px; color: var(--tmx-text-muted, #999);"></i>'}
          </div>`;
        })
        .join('');

      // Tier header with status/action
      let statusHtml = '';
      if (tier.resolved) {
        statusHtml = `<span style="font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 10px; background: #1b5e20; color: #fff;">Resolved</span>`;
      } else if (canResolve) {
        statusHtml = `<button class="draft-resolve-tier-btn" data-tier-index="${tierIdx}" style="font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 10px; border: none; background: var(--tmx-accent-teal, #00b8a9); color: #fff; cursor: pointer;">Resolve tier</button>`;
      } else if (!allSubmitted) {
        statusHtml = `<span style="font-size: 11px; color: #e65100;">${submittedCount}/${totalCount} submitted</span>`;
      } else {
        statusHtml = `<span style="font-size: 11px; color: var(--tmx-text-muted, #999);">waiting</span>`;
      }

      return `<div style="${TIER_HEADER} display: flex; align-items: center; justify-content: space-between;">
        <span>Tier ${tierIdx + 1} — ${totalCount} participants</span>
        ${statusHtml}
      </div>${participantRows}`;
    })
    .join('');
}

function tierCountOptions(totalParticipants: number, current: number): string {
  const max = Math.min(totalParticipants, 10);
  return Array.from({ length: max }, (_, i) => i + 1)
    .map((n) => `<option value="${n}" ${n === current ? 'selected' : ''}>${n}</option>`)
    .join('');
}

function prefCountOptions(availableCount: number, current: number): string {
  const max = Math.min(availableCount, 10);
  return Array.from({ length: max }, (_, i) => i + 1)
    .map((n) => `<option value="${n}" ${n === current ? 'selected' : ''}>${n}</option>`)
    .join('');
}

function getParticipantsMap(): Map<string, string> {
  const { participants } = tournamentEngine.getParticipants() as any;
  const map = new Map<string, string>();
  for (const p of participants || []) {
    map.set(p.participantId, p.participantName);
  }
  return map;
}
