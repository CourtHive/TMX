/**
 * Configure Draft modal.
 * TD interface for managing draft tiers, preferences count, and entering
 * preferences on behalf of participants.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, openModal } from './baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine, fixtures } from 'tods-competition-factory';
import { getTournamentScaleOptions, getParticipantScaleValues, ScaleOption } from './draftScaleOptions';

const { ratingsParameters } = fixtures;

// constants
import { INITIALIZE_DRAFT, RESOLVE_DRAFT_POSITIONS, SET_DRAW_POSITION_PREFERENCES } from 'constants/mutationConstants';

const IS_WARNING = 'is-warning';
const IS_PRIMARY = 'is-primary';
const ACCENT_TEAL = 'var(--tmx-accent-teal, #00b8a9)';

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
  const { draftState, summary, error } = tournamentEngine.getDraftState({ drawId });

  if (error || !draftState) {
    tmxToast({ message: 'No draft found for this draw', intent: IS_WARNING });
    return;
  }

  if (draftState.status === 'COMPLETE') {
    openTransparencyReport({ draftState, participants: getParticipantsMap() });
    return;
  }

  const participants = getParticipantsMap();
  const availablePositions = draftState.unassignedDrawPositions || [];
  const anyTierResolved = draftState.tiers?.some((t: any) => t.resolved);
  const anyPrefsSubmitted = summary.preferencesSubmitted > 0;
  const showConfigBar = !anyTierResolved;
  const configLocked = anyPrefsSubmitted;

  const currentTierMethod = draftState.tierMethod || 'ENTRY_ORDER';
  const currentScaleName = draftState.scaleAttributes?.scaleName || '';
  const selectStyle =
    'padding: 2px 6px; border-radius: 3px; border: 1px solid var(--tmx-border-secondary, #555); background: var(--tmx-bg-elevated, #fff); color: var(--tmx-text-primary, #363636); outline: none;';

  // Discover scales present in the tournament for the event's type
  const eventType = resolveEventType(eventId);
  const scaleOptions = discoverScaleOptions(eventType);
  const ratingOptions = scaleOptions.filter((o) => o.scaleType === 'RATING');
  const rankingOptions = scaleOptions.filter((o) => o.scaleType === 'RANKING');

  const showScaleSelect = currentTierMethod === 'RATING' || currentTierMethod === 'RANKING';
  const activeOptions = currentTierMethod === 'RATING' ? ratingOptions : rankingOptions;

  // Resolve sort direction: from draft state, or default from ratingsParameters
  const currentAscending = draftState.ascending ?? defaultAscending(currentTierMethod, currentScaleName);

  // Build scale value lookup for participant rows
  const scaleValues =
    currentScaleName && (currentTierMethod === 'RATING' || currentTierMethod === 'RANKING')
      ? buildScaleValuesMap(currentTierMethod as 'RATING' | 'RANKING', currentScaleName, eventType)
      : new Map<string, string>();

  const disabledAttr = configLocked ? ' disabled' : '';
  const lockedOpacity = configLocked ? ' opacity: 0.5;' : '';

  const configBar = showConfigBar
    ? `<div style="display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--tmx-border-secondary, #eee);">
        <label style="display: flex; align-items: center; gap: 6px; color: var(--tmx-text-primary, #363636);${lockedOpacity}">
          Tiers:
          <select id="draft-tier-count" style="${selectStyle}"${disabledAttr}>
            ${tierCountOptions(summary.totalParticipants, summary.tiersTotal)}
          </select>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; color: var(--tmx-text-primary, #363636);${lockedOpacity}">
          Sort by:
          <select id="draft-tier-method" style="${selectStyle}"${disabledAttr}>
            <option value="ENTRY_ORDER" ${currentTierMethod === 'ENTRY_ORDER' ? 'selected' : ''}>Entry order</option>
            <option value="RANKING" ${currentTierMethod === 'RANKING' ? 'selected' : ''}>Ranking</option>
            <option value="RATING" ${currentTierMethod === 'RATING' ? 'selected' : ''}>Rating</option>
          </select>
        </label>
        <label id="draft-scale-name-label" style="display: ${showScaleSelect && activeOptions.length ? 'flex' : 'none'}; align-items: center; gap: 6px; color: var(--tmx-text-primary, #363636);${lockedOpacity}">
          Scale:
          <select id="draft-scale-name" style="${selectStyle}"${disabledAttr}>
            ${scaleSelectOptions(activeOptions, currentScaleName)}
          </select>
        </label>
        <label id="draft-direction-label" style="display: ${showScaleSelect && activeOptions.length ? 'flex' : 'none'}; align-items: center; gap: 6px; color: var(--tmx-text-primary, #363636);${lockedOpacity}">
          Tier 1:
          <select id="draft-sort-direction" style="${selectStyle}"${disabledAttr}>
            <option value="asc" ${currentAscending ? 'selected' : ''}>Lowest first</option>
            <option value="desc" ${!currentAscending ? 'selected' : ''}>Highest first</option>
          </select>
        </label>
        <span id="draft-no-scales-msg" style="display: ${showScaleSelect && !activeOptions.length ? 'inline' : 'none'}; font-size: 12px; color: #e65100; font-style: italic;">No ${currentTierMethod === 'RATING' ? 'ratings' : 'rankings'} in tournament</span>
        <label style="display: flex; align-items: center; gap: 6px; color: var(--tmx-text-primary, #363636);${lockedOpacity}">
          Max preferences:
          <select id="draft-pref-count" style="${selectStyle}"${disabledAttr}>
            ${prefCountOptions(availablePositions.length, draftState.preferencesCount ?? 3)}
          </select>
        </label>
        <button id="draft-clear-prefs-btn" ${configLocked ? '' : 'disabled'} style="padding: 3px 10px; font-size: 12px; border-radius: 3px; border: 1px solid #e65100; background: transparent; color: #e65100; cursor: pointer; font-weight: 500; opacity: ${configLocked ? '1' : '0.4'};">
          Clear preferences
        </button>
      </div>`
    : '';

  const content = `
    <div style="font-size: 0.9em; overflow: hidden;">
      ${configBar}
      <div style="display: flex; gap: 12px; margin-bottom: 12px;">
        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 12px; background: var(--tmx-panel-blue-bg, #e8f4fd); color: var(--tmx-panel-blue-text, #1a73e8);">
          ${availablePositions.length} available position${availablePositions.length === 1 ? '' : 's'}
        </span>
        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 12px; background: ${summary.preferencesSubmitted === summary.totalParticipants ? '#1b5e20' : '#e65100'}; color: #fff;">
          ${summary.preferencesSubmitted} of ${summary.totalParticipants} submitted
        </span>
      </div>

      <div id="draft-config-lock-msg" style="display: ${configLocked ? 'block' : 'none'}; font-size: 12px; color: var(--tmx-text-secondary, #666); margin-bottom: 4px; font-style: italic;">Configuration locked — preferences have been submitted</div>
      <div id="draft-tiers-container" style="max-height: 350px; overflow-y: auto; border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 4px;">
        ${renderTiers(draftState, participants, scaleValues)}
      </div>
    </div>
  `;

  openModal({
    title: 'Configure Draft',
    content,
    buttons: [{ label: 'Done', intent: IS_PRIMARY, close: true }],
    config: { padding: '.5', maxWidth: 700 },
  });

  // Wire up interactions after DOM is ready
  setTimeout(() => {
    if (showConfigBar) {
      const tierSelect = document.getElementById('draft-tier-count') as HTMLSelectElement;
      const prefSelect = document.getElementById('draft-pref-count') as HTMLSelectElement;
      const tierMethodSelect = document.getElementById('draft-tier-method') as HTMLSelectElement;
      const scaleNameLabel = document.getElementById('draft-scale-name-label') as HTMLElement;
      const scaleNameSelect = document.getElementById('draft-scale-name') as HTMLSelectElement;
      const directionLabel = document.getElementById('draft-direction-label') as HTMLElement;
      const directionSelect = document.getElementById('draft-sort-direction') as HTMLSelectElement;
      const noScalesMsg = document.getElementById('draft-no-scales-msg') as HTMLElement;
      const clearPrefsBtn = document.getElementById('draft-clear-prefs-btn') as HTMLButtonElement;

      const getSelectedAscending = () => directionSelect?.value === 'asc';

      /** Build scaleAttributes from current control values, including accessor and eventType. */
      const getScaleAttributes = () => {
        const method = tierMethodSelect?.value || '';
        const scale = scaleNameSelect?.value || '';
        if (method === 'RATING' && scale) {
          const accessor = (ratingsParameters as any)?.[scale]?.accessor;
          return {
            scaleType: 'RATING',
            scaleName: scale,
            ...(eventType && { eventType }),
            ...(accessor && { accessor }),
          };
        }
        if (method === 'RANKING' && scale) {
          return { scaleType: 'RANKING', scaleName: scale, ...(eventType && { eventType }) };
        }
        return undefined;
      };

      /** Read current config values from controls, re-initialize draft, and refresh tiers in-place. */
      const applyConfig = () => {
        const params = {
          drawId,
          eventId,
          tierCount: Number.parseInt(tierSelect?.value || '3'),
          preferencesCount: Number.parseInt(prefSelect?.value || '3'),
          tierMethod: tierMethodSelect?.value || 'ENTRY_ORDER',
          ascending: getSelectedAscending(),
          scaleAttributes: getScaleAttributes(),
          force: true,
        };
        mutationRequest({
          methods: [{ method: INITIALIZE_DRAFT, params }],
          callback: (result: any) => {
            if (result.success) {
              refreshTierList({ drawId, eventId, callback });
            } else {
              tmxToast({ message: result.error?.message || 'Reconfigure failed', intent: IS_WARNING });
            }
          },
        });
      };

      const updateScaleDropdown = () => {
        const method = tierMethodSelect?.value;
        const needsScale = method === 'RATING' || method === 'RANKING';
        const opts = method === 'RATING' ? ratingOptions : rankingOptions;

        if (scaleNameLabel) scaleNameLabel.style.display = needsScale && opts.length ? 'flex' : 'none';
        if (directionLabel) directionLabel.style.display = needsScale && opts.length ? 'flex' : 'none';
        if (noScalesMsg) {
          noScalesMsg.style.display = needsScale && !opts.length ? 'inline' : 'none';
          noScalesMsg.textContent = `No ${method === 'RATING' ? 'ratings' : 'rankings'} in tournament`;
        }
        if (scaleNameSelect && needsScale) {
          scaleNameSelect.innerHTML = scaleSelectOptions(opts, currentScaleName);
        }
        if (directionSelect && needsScale) {
          const newDefault = defaultAscending(method, scaleNameSelect?.value || '');
          directionSelect.value = newDefault ? 'asc' : 'desc';
        }
        applyConfig();
      };

      tierSelect?.addEventListener('change', applyConfig);
      prefSelect?.addEventListener('change', applyConfig);
      tierMethodSelect?.addEventListener('change', updateScaleDropdown);
      scaleNameSelect?.addEventListener('change', () => {
        if (directionSelect) {
          const method = tierMethodSelect?.value || '';
          const newDefault = defaultAscending(method, scaleNameSelect.value);
          directionSelect.value = newDefault ? 'asc' : 'desc';
        }
        applyConfig();
      });
      directionSelect?.addEventListener('change', applyConfig);

      clearPrefsBtn?.addEventListener('click', applyConfig);
    }

    rewireParticipantClicks(drawId, eventId, draftState, participants, callback);
  }, 0);
}

/**
 * Wire click handlers on participant rows, resolved rows, and resolve-tier buttons
 * inside the currently rendered #draft-tiers-container. Called on initial render
 * and after any re-render (scale change, tier resolution, etc.).
 */
function rewireParticipantClicks(
  drawId: string,
  eventId: string,
  draftState: any,
  participants: Map<string, string>,
  callback?: () => void,
): void {
  const rows = document.querySelectorAll('.draft-participant-clickable');
  rows.forEach((row) => {
    row.addEventListener('click', () => {
      const participantId = (row as HTMLElement).dataset.participantId;
      if (participantId) {
        openPreferenceEntry({ drawId, eventId, participantId, draftState, participants, callback });
      }
    });
  });

  const resolvedRows = document.querySelectorAll('.draft-participant-resolved');
  resolvedRows.forEach((row) => {
    row.addEventListener('click', () => {
      const participantId = (row as HTMLElement).dataset.participantId;
      if (participantId) {
        openResolutionDetail({ drawId, eventId, participantId, draftState, participants, callback });
      }
    });
  });

  const resolveBtns = document.querySelectorAll('.draft-resolve-tier-btn');
  resolveBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tierIndex = Number.parseInt((btn as HTMLElement).dataset.tierIndex || '');
      if (Number.isNaN(tierIndex)) return;

      mutationRequest({
        methods: [
          {
            method: RESOLVE_DRAFT_POSITIONS,
            params: { drawId, eventId, tierIndex },
          },
        ],
        callback: (result: any) => {
          const innerErrors = result.results?.[0]?.errors;
          if (result.success && !innerErrors?.length) {
            tmxToast({ message: `Tier ${tierIndex + 1} resolved`, intent: 'is-success' });
            if (callback) callback();
            refreshTierList({ drawId, eventId, callback });
          } else if (result.success && innerErrors?.length) {
            tmxToast({
              message: `Tier ${tierIndex + 1}: ${innerErrors.length} placement error(s)`,
              intent: IS_WARNING,
            });
            if (callback) callback();
            refreshTierList({ drawId, eventId, callback });
          } else {
            tmxToast({
              message: result.error?.message || result.info || 'Failed to resolve tier',
              intent: IS_WARNING,
            });
          }
        },
      });
    });
  });
}

/**
 * Sub-modal: preference entry for a single participant.
 * TD clicks available positions to rank them as preferences.
 * Includes prev/next navigation across unresolved participants.
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
  const maxPrefs = draftState.preferencesCount ?? 3;
  const available = draftState.unassignedDrawPositions || [];

  // Build ordered list of unresolved participants for navigation
  const unresolvedIds: string[] = [];
  for (const tier of draftState.tiers || []) {
    if (tier.resolved) continue;
    for (const pid of tier.participantIds || []) {
      unresolvedIds.push(pid);
    }
  }

  let currentIndex = unresolvedIds.indexOf(participantId);
  if (currentIndex < 0) currentIndex = 0;
  let currentPid = unresolvedIds[currentIndex];
  let selected: number[] = [...(draftState.preferences[currentPid] || [])];

  const renderPositionGrid = () => {
    return available
      .map((pos: number) => {
        const idx = selected.indexOf(pos);
        const isSelected = idx >= 0;
        const rank = idx + 1;
        const bg = isSelected ? ACCENT_TEAL : 'var(--tmx-bg-secondary, #f5f5f5)';
        const color = isSelected ? '#fff' : 'var(--tmx-text-primary, #363636)';
        const badge = isSelected
          ? `<span style="position:absolute;top:-2px;right:-2px;background:#e74c3c;color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;">${rank}</span>`
          : '';

        return `<div class="draft-pos-btn" data-position="${pos}" style="position:relative; display:inline-flex; align-items:center; justify-content:center; min-width:36px; height:36px; padding:4px 8px; margin:3px; border-radius:4px; border:1px solid var(--tmx-border-secondary, #ccc); background:${bg}; color:${color}; cursor:pointer; font-size:14px; font-weight:600; transition: all 0.15s;">${pos}${badge}</div>`;
      })
      .join('');
  };

  const wirePositionClicks = () => {
    const btns = document.querySelectorAll('.draft-pos-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const pos = Number.parseInt((btn as HTMLElement).dataset.position || '');
        if (Number.isNaN(pos)) return;

        const existingIdx = selected.indexOf(pos);
        if (existingIdx >= 0) {
          selected.splice(existingIdx, 1);
        } else if (selected.length < maxPrefs) {
          selected.push(pos);
        }
        updateView();
      });
    });
  };

  const renderContent = () => {
    const name = participants.get(currentPid) || currentPid.slice(0, 8);
    return `
      <div style="font-size: 0.9em; overflow: hidden;">
        <div style="margin-bottom: 10px; color: var(--tmx-text-secondary, #666); font-size: 13px;">
          Click draw positions in order of preference for <strong>${name}</strong>.
        </div>
        <div id="pref-selection-summary" style="margin-bottom: 10px; font-size: 13px; color: var(--tmx-text-secondary, #666);">
          ${selected.length ? `Selected: ${selected.join(' → ')} (${selected.length}/${maxPrefs})` : `Click positions to rank preferences (max ${maxPrefs})`}
        </div>
        <div id="pref-positions-grid" style="display: flex; flex-wrap: wrap; padding: 8px; border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 4px; max-height: 250px; overflow: auto;">
          ${renderPositionGrid()}
        </div>
        ${
          unresolvedIds.length > 1
            ? `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--tmx-border-secondary, #eee);">
          <button id="pref-nav-prev" ${currentIndex <= 0 ? 'disabled' : ''} style="padding: 4px 12px; font-size: 12px; border-radius: 4px; border: 1px solid var(--tmx-border-secondary, #555); background: var(--tmx-bg-secondary, #333); color: var(--tmx-text-primary, #ccc); cursor: ${currentIndex <= 0 ? 'default' : 'pointer'}; opacity: ${currentIndex <= 0 ? '0.3' : '1'};">
            ← Prev
          </button>
          <span style="font-size: 12px; color: var(--tmx-text-muted, #999);">${currentIndex + 1} of ${unresolvedIds.length}</span>
          <button id="pref-nav-next" ${currentIndex >= unresolvedIds.length - 1 ? 'disabled' : ''} style="padding: 4px 12px; font-size: 12px; border-radius: 4px; border: 1px solid var(--tmx-border-secondary, #555); background: var(--tmx-bg-secondary, #333); color: var(--tmx-text-primary, #ccc); cursor: ${currentIndex >= unresolvedIds.length - 1 ? 'default' : 'pointer'}; opacity: ${currentIndex >= unresolvedIds.length - 1 ? '0.3' : '1'};">
            Next →
          </button>
        </div>`
            : ''
        }
      </div>
    `;
  };

  const updateTitle = () => {
    const name = participants.get(currentPid) || currentPid.slice(0, 8);
    const titleEls = document.querySelectorAll('.chc-modal-title');
    const titleEl = titleEls[titleEls.length - 1] as HTMLElement;
    if (titleEl) titleEl.textContent = `Preferences — ${name}`;
  };

  const updateBody = () => {
    const sections = document.querySelectorAll('section[role="dialog"]');
    const lastSection = sections[sections.length - 1];
    // The body is the div after the header div
    const bodyEl = lastSection?.querySelector('div > div:nth-child(2)') as HTMLElement;
    if (bodyEl) bodyEl.innerHTML = renderContent();
  };

  const updateView = () => {
    updateBody();
    updateTitle();
    wirePositionClicks();
    wireNavigation();
  };

  /** Save current selections, then call onDone */
  const saveAndDo = (onDone: () => void) => {
    const existing = draftState.preferences[currentPid] || [];
    const changed = selected.length !== existing.length || selected.some((v, i) => v !== existing[i]);

    if (!changed) {
      onDone();
      return;
    }

    mutationRequest({
      methods: [
        {
          method: SET_DRAW_POSITION_PREFERENCES,
          params: { drawId, eventId, participantId: currentPid, preferences: selected },
        },
      ],
      callback: (result: any) => {
        if (result.success) {
          // Update local draft state so navigation reflects the save
          draftState.preferences[currentPid] = [...selected];
          onDone();
        } else {
          tmxToast({ message: result.error?.message || 'Failed to save preferences', intent: IS_WARNING });
        }
      },
    });
  };

  const wireNavigation = () => {
    const prevBtn = document.getElementById('pref-nav-prev');
    const nextBtn = document.getElementById('pref-nav-next');

    prevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentIndex <= 0) return;
      saveAndDo(() => {
        currentIndex--;
        currentPid = unresolvedIds[currentIndex];
        selected = [...(draftState.preferences[currentPid] || [])];
        updateView();
      });
    });

    nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentIndex >= unresolvedIds.length - 1) return;
      saveAndDo(() => {
        currentIndex++;
        currentPid = unresolvedIds[currentIndex];
        selected = [...(draftState.preferences[currentPid] || [])];
        updateView();
      });
    });
  };

  openModal({
    title: `Preferences — ${participants.get(currentPid) || currentPid.slice(0, 8)}`,
    content: renderContent(),
    buttons: [
      {
        label: 'Clear',
        intent: IS_WARNING,
        close: false,
        onClick: () => {
          selected = [];
          updateView();
        },
      },
      {
        label: 'Done',
        intent: IS_PRIMARY,
        close: false,
        onClick: () => {
          saveAndDo(() => {
            closeModal();
            refreshTierList({ drawId, eventId, callback });
          });
        },
      },
    ],
    config: { padding: '.5', maxWidth: 500 },
  });

  setTimeout(() => {
    applyModalGlow();
    wirePositionClicks();
    wireNavigation();
  }, 0);
}

/**
 * Read-only modal showing how a resolved participant's position was decided.
 */
function openResolutionDetail({
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
  // Build ordered list of all resolved participant IDs for navigation
  const resolvedIds: string[] = [];
  for (const tier of draftState.tiers || []) {
    if (!tier.resolved || !tier.resolutions) continue;
    for (const pid of tier.participantIds || []) {
      if (tier.resolutions[pid]) resolvedIds.push(pid);
    }
  }

  let currentIndex = resolvedIds.indexOf(participantId);
  if (currentIndex < 0) currentIndex = 0;

  const renderDetail = (pid: string) => {
    const name = participants.get(pid) || pid.slice(0, 8);
    const prefs: number[] = draftState.preferences[pid] || [];

    let resolution: any;
    let tierNumber = 0;
    for (let i = 0; i < (draftState.tiers?.length || 0); i++) {
      const tier = draftState.tiers[i];
      if (tier.resolutions?.[pid]) {
        resolution = tier.resolutions[pid];
        tierNumber = i + 1;
        break;
      }
    }

    if (!resolution) return { name, html: '' };

    const assignedPos = resolution.assignedPosition;
    const prefMatch = resolution.preferenceMatch;
    const matchLabel = prefMatch ? `${ordinal(prefMatch)} choice` : 'Random placement';
    const matchColor = prefMatch === 1 ? '#48c774' : prefMatch === 2 ? '#00b8a9' : prefMatch ? '#aaa' : '#999';

    const selectionOrderHtml = prefs.length
      ? prefs
          .map((pos: number, idx: number) => {
            const isAssigned = pos === assignedPos;
            const bg = isAssigned ? '#1b5e20' : ACCENT_TEAL;
            return `<div style="display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-bottom: 1px solid var(--tmx-border-secondary, #333);">
              <span style="display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; border-radius: 50%; background: #e74c3c; color: #fff; font-size: 11px; font-weight: 700;">${idx + 1}</span>
              <span style="display: inline-flex; align-items: center; justify-content: center; min-width: 36px; height: 30px; padding: 0 10px; border-radius: 4px; background: ${bg}; color: #fff; font-size: 14px; font-weight: 700;">Position ${pos}</span>
              ${isAssigned ? '<span style="font-size: 12px; font-weight: 600; color: #48c774;">← Assigned</span>' : ''}
            </div>`;
          })
          .join('')
      : `<div style="padding: 10px; color: var(--tmx-text-muted, #999); font-style: italic;">No preferences were submitted</div>`;

    const html = `
      <div style="font-size: 0.9em; overflow: hidden;">
        <div style="margin-bottom: 12px; padding: 8px 12px; border-radius: 4px; background: #1b5e20; color: #fff; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: space-between;">
          <span>Assigned position ${assignedPos}</span>
          <span style="font-size: 12px; color: ${matchColor}; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 8px;">${matchLabel}</span>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <span style="font-size: 12px; padding: 2px 8px; border-radius: 8px; background: var(--tmx-bg-secondary, #333); color: var(--tmx-text-secondary, #aaa);">Tier ${tierNumber}</span>
          <span style="font-size: 12px; padding: 2px 8px; border-radius: 8px; background: var(--tmx-bg-secondary, #333); color: var(--tmx-text-secondary, #aaa);">${prefs.length} preference${prefs.length > 1 ? 's' : ''} submitted</span>
        </div>

        <div style="font-weight: 600; font-size: 13px; color: var(--tmx-text-secondary, #666); margin-bottom: 6px;">
          Selection order
        </div>
        <div style="border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 4px; overflow: hidden;">
          ${selectionOrderHtml}
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--tmx-border-secondary, #eee);">
          <button id="draft-res-prev" ${currentIndex <= 0 ? 'disabled' : ''} style="padding: 4px 12px; font-size: 12px; border-radius: 4px; border: 1px solid var(--tmx-border-secondary, #555); background: var(--tmx-bg-secondary, #333); color: var(--tmx-text-primary, #ccc); cursor: ${currentIndex <= 0 ? 'default' : 'pointer'}; opacity: ${currentIndex <= 0 ? '0.3' : '1'};">
            ← Prev
          </button>
          <span style="font-size: 12px; color: var(--tmx-text-muted, #999);">${currentIndex + 1} of ${resolvedIds.length}</span>
          <button id="draft-res-next" ${currentIndex >= resolvedIds.length - 1 ? 'disabled' : ''} style="padding: 4px 12px; font-size: 12px; border-radius: 4px; border: 1px solid var(--tmx-border-secondary, #555); background: var(--tmx-bg-secondary, #333); color: var(--tmx-text-primary, #ccc); cursor: ${currentIndex >= resolvedIds.length - 1 ? 'default' : 'pointer'}; opacity: ${currentIndex >= resolvedIds.length - 1 ? '0.3' : '1'};">
            Next →
          </button>
        </div>
      </div>
    `;

    return { name, html };
  };

  const { name: initialName, html: initialHtml } = renderDetail(resolvedIds[currentIndex]);

  openModal({
    title: `Resolution — ${initialName}`,
    content: initialHtml,
    buttons: [
      {
        label: 'Close',
        intent: IS_PRIMARY,
        close: false,
        onClick: () => {
          closeModal();
          refreshTierList({ drawId, eventId, callback });
        },
      },
    ],
    config: { padding: '.5', maxWidth: 500 },
  });

  const wireNavigation = () => {
    const prevBtn = document.getElementById('draft-res-prev');
    const nextBtn = document.getElementById('draft-res-next');

    const navigate = (delta: number) => {
      currentIndex += delta;
      if (currentIndex < 0) currentIndex = 0;
      if (currentIndex >= resolvedIds.length) currentIndex = resolvedIds.length - 1;

      const { name: newName, html: newHtml } = renderDetail(resolvedIds[currentIndex]);

      // Update title
      const titleEls = document.querySelectorAll('.chc-modal-title');
      const titleEl = titleEls[titleEls.length - 1] as HTMLElement;
      if (titleEl) titleEl.textContent = `Resolution — ${newName}`;

      // Update body — find the last modal's body content
      const sections = document.querySelectorAll('section[role="dialog"]');
      const lastSection = sections[sections.length - 1];
      const bodyEl = lastSection?.querySelector('div > div + div') as HTMLElement;
      if (bodyEl) bodyEl.innerHTML = newHtml;

      wireNavigation();
    };

    prevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentIndex > 0) navigate(-1);
    });
    nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentIndex < resolvedIds.length - 1) navigate(1);
    });
  };

  setTimeout(() => {
    applyModalGlow();
    wireNavigation();
  }, 0);
}

/** Apply teal glow to the topmost modal dialog. */
function applyModalGlow() {
  const dialogs = document.querySelectorAll('.chc-modal-dialog');
  const dialog = dialogs[dialogs.length - 1] as HTMLElement;
  if (dialog) {
    dialog.style.boxShadow = '0 0 20px 4px rgba(0, 184, 169, 0.4), 0 0 60px 8px rgba(0, 184, 169, 0.15)';
    dialog.style.border = '1px solid ${ACCENT_TEAL}';
  }
}

function renderTiers(
  draftState: any,
  participants: Map<string, string>,
  scaleValues?: Map<string, string>,
): string {
  const tiers = draftState.tiers || [];
  const preferences = draftState.preferences || {};

  const scaleBadge = (pid: string) => {
    const val = scaleValues?.get(pid);
    if (!val) return '';
    return `<span style="display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 20px; padding: 0 6px; font-size: 11px; font-weight: 600; border-radius: 3px; background: var(--tmx-bg-secondary, #f0f0f0); color: var(--tmx-text-secondary, #666); margin-right: 6px; flex-shrink: 0;">${val}</span>`;
  };

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

          // Resolved tier — show result, no editing
          if (tier.resolved) {
            const res = tier.resolutions?.[pid];
            if (res) {
              const pos = res.assignedPosition;
              const match = res.preferenceMatch;
              const matchLabel = match ? `${ordinal(match)} choice` : 'Random';
              const matchColor =
                match === 1
                  ? '#48c774'
                  : match === 2
                    ? ACCENT_TEAL
                    : match
                      ? 'var(--tmx-text-secondary, #666)'
                      : 'var(--tmx-text-muted, #999)';
              const prefsText = prefs?.length ? `(prefs: ${prefs.join(', ')})` : '';

              return `<div class="draft-participant-row draft-participant-resolved" data-participant-id="${pid}" style="${ROW_STYLE}">
                ${scaleBadge(pid)}<span style="flex: 1; color: var(--tmx-text-primary, #363636);">${name}</span>
                <span style="font-size: 12px; color: var(--tmx-text-muted, #999); margin-right: 4px;">${prefsText}</span>
                <span style="font-size: 12px; font-weight: 600; color: ${matchColor};">${matchLabel}</span>
                <span style="display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 22px; padding: 0 6px; font-size: 12px; font-weight: 700; border-radius: 4px; background: #1b5e20; color: #fff;">${pos}</span>
              </div>`;
            }

            // Resolved but no resolution data (tier was resolved before resolutions tracking was added)
            const prefDisplay = prefs?.length
              ? `<span style="color: ${ACCENT_TEAL}; font-size: 12px;">${prefs.join(', ')}</span>`
              : `<span style="color: var(--tmx-text-muted, #999); font-size: 12px; font-style: italic;">none</span>`;

            return `<div class="draft-participant-row" style="${ROW_STYLE} cursor: default; opacity: 0.6;">
              ${scaleBadge(pid)}<span style="flex: 1; color: var(--tmx-text-primary, #363636);">${name}</span>
              <span style="display: flex; align-items: center;">${prefDisplay}</span>
            </div>`;
          }

          // Unresolved tier — editable
          const prefDisplay = prefs?.length
            ? `<span style="color: ${ACCENT_TEAL}; font-size: 12px;">${prefs.join(', ')}</span>`
            : `<span style="color: var(--tmx-text-muted, #999); font-size: 12px; font-style: italic;">none</span>`;

          return `<div class="draft-participant-row draft-participant-clickable" data-participant-id="${pid}" style="${ROW_STYLE}">
            ${scaleBadge(pid)}<span style="flex: 1; color: var(--tmx-text-primary, #363636);">${name}</span>
            <span style="display: flex; align-items: center;">${prefDisplay}</span>
            <i class="fa-solid fa-pencil" style="font-size: 11px; color: var(--tmx-text-muted, #999);"></i>
          </div>`;
        })
        .join('');

      // Tier header with status/action
      let statusHtml: string;
      if (tier.resolved) {
        statusHtml = `<span style="font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 10px; background: #1b5e20; color: #fff;">Resolved</span>`;
      } else if (canResolve) {
        statusHtml = `<button class="draft-resolve-tier-btn" data-tier-index="${tierIdx}" style="font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 10px; border: none; background: ${ACCENT_TEAL}; color: #fff; cursor: pointer;">Resolve tier</button>`;
      } else if (allSubmitted) {
        statusHtml = `<span style="font-size: 11px; color: var(--tmx-text-muted, #999);">waiting</span>`;
      } else {
        statusHtml = `<span style="font-size: 11px; color: #e65100;">${submittedCount}/${totalCount} submitted</span>`;
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

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Refresh the tier list and status pills in the existing Configure Draft modal
 * without reopening it (preserves scroll position).
 */
function refreshTierList({
  drawId,
  eventId,
  callback,
}: {
  drawId: string;
  eventId: string;
  callback?: () => void;
}): void {
  const { draftState, summary } = tournamentEngine.getDraftState({ drawId });
  if (!draftState) return;

  const participants = getParticipantsMap();
  const availablePositions = draftState.unassignedDrawPositions || [];

  const tierMethod = draftState.tierMethod || 'ENTRY_ORDER';
  const scaleName = draftState.scaleAttributes?.scaleName || '';
  const eventType = resolveEventType(eventId);
  const scaleValues =
    scaleName && (tierMethod === 'RATING' || tierMethod === 'RANKING')
      ? buildScaleValuesMap(tierMethod, scaleName, eventType)
      : new Map<string, string>();

  // Update tier container content
  const tiersContainer = document.getElementById('draft-tiers-container');
  if (tiersContainer) {
    tiersContainer.innerHTML = renderTiers(draftState, participants, scaleValues);
  }

  // Update status pills — find the pills container in the Configure Draft modal
  // The pills are sibling spans inside a flex div before #draft-tiers-container
  const pillsContainer = tiersContainer?.previousElementSibling as HTMLElement;
  if (pillsContainer) {
    const pills = pillsContainer.querySelectorAll('span');
    if (pills.length >= 1) {
      pills[0].textContent = `${availablePositions.length} available position${availablePositions.length === 1 ? '' : 's'}`;
    }
    if (pills.length >= 2 && summary) {
      pills[1].textContent = `${summary.preferencesSubmitted} of ${summary.totalParticipants} submitted`;
      pills[1].style.background = summary.preferencesSubmitted === summary.totalParticipants ? '#1b5e20' : '#e65100';
    }
  }

  // Update config lock state based on current preferences
  updateConfigLockState(summary.preferencesSubmitted > 0);

  // Re-wire click handlers
  rewireParticipantClicks(drawId, eventId, draftState, participants, callback);
}

/**
 * Dynamically enable/disable all config controls and the clear button
 * based on whether any preferences have been submitted.
 */
function updateConfigLockState(hasPreferences: boolean): void {
  const configSelectIds = ['draft-tier-count', 'draft-tier-method', 'draft-scale-name', 'draft-sort-direction', 'draft-pref-count'];
  for (const id of configSelectIds) {
    const el = document.getElementById(id) as HTMLSelectElement;
    if (el) {
      el.disabled = hasPreferences;
      const label = el.closest('label') as HTMLElement;
      if (label) label.style.opacity = hasPreferences ? '0.5' : '1';
    }
  }

  const clearBtn = document.getElementById('draft-clear-prefs-btn') as HTMLButtonElement;
  if (clearBtn) {
    clearBtn.disabled = !hasPreferences;
    clearBtn.style.opacity = hasPreferences ? '1' : '0.4';
  }

  const lockMsg = document.getElementById('draft-config-lock-msg') as HTMLElement;
  if (lockMsg) {
    lockMsg.style.display = hasPreferences ? 'block' : 'none';
  }
}

/**
 * Read-only modal showing the full transparency report for a completed draft.
 */
function openTransparencyReport({
  draftState,
  participants,
}: {
  draftState: any;
  participants: Map<string, string>;
}): void {
  const report: any[] = draftState.transparencyReport || [];
  const resolvedAt = draftState.resolvedAt ? new Date(draftState.resolvedAt).toLocaleString() : '';

  // Stats
  const total = report.length;
  const got1st = report.filter((r: any) => r.preferenceMatch === 1).length;
  const got2nd = report.filter((r: any) => r.preferenceMatch === 2).length;
  const got3rd = report.filter((r: any) => r.preferenceMatch === 3).length;
  const gotOther = report.filter((r: any) => r.preferenceMatch && r.preferenceMatch > 3).length;
  const gotRandom = report.filter((r: any) => !r.preferenceMatch).length;

  const statPill = (label: string, count: number, bg: string) =>
    count
      ? `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 12px; background: ${bg}; color: #fff;">${count} ${label}</span>`
      : '';

  const rows = report
    .map((entry: any) => {
      const name = participants.get(entry.participantId) || entry.participantId?.slice(0, 8);
      const prefs = entry.preferences || [];
      const pos = entry.assignedPosition;
      const match = entry.preferenceMatch;
      const matchLabel = match ? `${ordinal(match)} choice` : 'Random';
      const matchColor =
        match === 1
          ? '#48c774'
          : match === 2
            ? ACCENT_TEAL
            : match
              ? 'var(--tmx-text-secondary, #666)'
              : 'var(--tmx-text-muted, #999)';
      const prefsText = prefs.length ? `(${prefs.join(', ')})` : '';

      return `<div style="${ROW_STYLE} cursor: default;">
        <span style="flex: 1; color: var(--tmx-text-primary, #363636);">${name}</span>
        <span style="font-size: 12px; color: var(--tmx-text-muted, #999); margin-right: 4px;">${prefsText}</span>
        <span style="font-size: 12px; font-weight: 600; color: ${matchColor};">${matchLabel}</span>
        <span style="display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 22px; padding: 0 6px; font-size: 12px; font-weight: 700; border-radius: 4px; background: #1b5e20; color: #fff;">${pos}</span>
      </div>`;
    })
    .join('');

  const content = `
    <div style="font-size: 0.9em; overflow: hidden;">
      ${resolvedAt ? `<div style="font-size: 12px; color: var(--tmx-text-muted, #999); margin-bottom: 8px;">Resolved ${resolvedAt}</div>` : ''}
      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
        ${statPill('1st choice', got1st, '#1b5e20')}
        ${statPill('2nd choice', got2nd, ACCENT_TEAL)}
        ${statPill('3rd choice', got3rd, '#1a73e8')}
        ${statPill('other choice', gotOther, '#666')}
        ${statPill('random', gotRandom, '#e65100')}
        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 12px; background: var(--tmx-bg-secondary, #333); color: var(--tmx-text-secondary, #aaa);">${total} total</span>
      </div>
      <div style="max-height: 350px; overflow-y: auto; border: 1px solid var(--tmx-border-secondary, #eee); border-radius: 4px;">
        ${rows || '<div style="padding: 12px; color: var(--tmx-text-muted, #999); font-style: italic;">No report data available</div>'}
      </div>
    </div>
  `;

  openModal({
    title: 'Draft Transparency Report',
    content,
    buttons: [{ label: 'Close', intent: 'is-info', close: true }],
    config: { padding: '.5', maxWidth: 700 },
  });
}

function resolveEventType(eventId: string): string | undefined {
  const { event } = tournamentEngine.getEvent({ eventId });
  return event?.eventType;
}

function discoverScaleOptions(eventType?: string): ScaleOption[] {
  const { participants = [] } = tournamentEngine.getParticipants({ withScaleValues: true }) ?? {};
  return getTournamentScaleOptions(participants, eventType);
}

function scaleSelectOptions(options: ScaleOption[], currentValue: string): string {
  if (!options.length) return '';
  return options
    .map((o) => `<option value="${o.value}" ${o.value === currentValue ? 'selected' : ''}>${o.value}</option>`)
    .join('');
}

/**
 * Returns the default ascending flag for a given tier method and scale name.
 * For ratings, uses `ratingsParameters[scaleName].ascending` if available.
 * For rankings, defaults to true (lower rank number = better = tier 1).
 * For entry order, returns false (not meaningful but a safe default).
 */
function defaultAscending(tierMethod: string, scaleName: string): boolean {
  if (tierMethod === 'RANKING') return true;
  if (tierMethod === 'RATING' && scaleName) {
    const params = (ratingsParameters as any)?.[scaleName];
    if (params && typeof params.ascending === 'boolean') return params.ascending;
    return false; // default: higher is better
  }
  return false;
}

function buildScaleValuesMap(
  scaleType: 'RATING' | 'RANKING',
  scaleName: string,
  eventType?: string,
): Map<string, string> {
  const { participants = [] } = tournamentEngine.getParticipants({ withScaleValues: true }) ?? {};
  const accessor = (ratingsParameters as any)?.[scaleName]?.accessor;
  return getParticipantScaleValues(participants, scaleType, scaleName, eventType, accessor);
}

function getParticipantsMap(): Map<string, string> {
  const { participants } = tournamentEngine.getParticipants();
  const map = new Map<string, string>();
  for (const p of participants || []) {
    map.set(p.participantId, p.participantName);
  }
  return map;
}
