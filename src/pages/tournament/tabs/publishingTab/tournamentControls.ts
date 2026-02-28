/**
 * Tournament-level publishing controls: Participants + Order of Play.
 * Includes publish toggles, embargo buttons (open modal), and per-date OOP selection.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getPublicTournamentUrl } from 'services/publishing/publicUrl';
import { getTournamentPublishData, getPublishingTableData } from './publishingData';
import { renderPublishingTab, isAnythingPublished } from './renderPublishingTab';
import { tmxToast } from 'services/notifications/tmxToast';
import { barButton, renderForm } from 'courthive-components';
import { openEmbargoModal } from './embargoModal';
import { tournamentEngine, eventConstants, fixtures } from 'tods-competition-factory';
import { t } from 'i18n';
import dayjs from 'dayjs';

import {
  PUBLISH_ORDER_OF_PLAY,
  UNPUBLISH_ORDER_OF_PLAY,
  PUBLISH_PARTICIPANTS,
  UNPUBLISH_PARTICIPANTS,
  UNPUBLISH_EVENT,
} from 'constants/mutationConstants';

const { ratingsParameters } = fixtures;
const { SINGLES } = eventConstants;

const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'pt-BR', label: 'Português' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ar', label: 'العربية' },
];

function createToggle(checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'pub-toggle';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const slider = document.createElement('span');
  slider.className = 'pub-slider';
  label.appendChild(input);
  label.appendChild(slider);
  return label;
}

function createStateBadge(state: 'live' | 'embargoed' | 'off', url?: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'pub-state-badge';
  if (state === 'live') {
    badge.classList.add('pub-state-live');
    badge.innerHTML = `<i class="fa fa-eye"></i> ${t('publishing.live')}`;
    if (url) {
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', () => window.open(url, '_blank'));
    }
  } else if (state === 'embargoed') {
    badge.classList.add('pub-state-embargoed');
    badge.innerHTML = `<i class="fa fa-clock"></i> ${t('publishing.embargoed')}`;
  } else {
    badge.classList.add('pub-state-off');
    badge.innerHTML = `<i class="fa fa-eye-slash"></i> ${t('publishing.off')}`;
  }
  return badge;
}

function formatEmbargoDisplay(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (d.getTime() <= Date.now()) return t('publishing.expired');
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createEmbargoButton(
  currentEmbargo: string | undefined,
  publishMethod: string,
  onRefresh: () => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; align-items:center; gap:6px; margin-left:auto;';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:0.8rem; color:var(--tmx-text-secondary);';
  label.textContent = `${t('publishing.embargo')}:`;
  wrapper.appendChild(label);

  if (currentEmbargo && new Date(currentEmbargo).getTime() > Date.now()) {
    const display = document.createElement('span');
    display.style.cssText = 'font-size:0.8rem; color:var(--tmx-accent-orange);';
    display.innerHTML = `<i class="fa fa-clock"></i> ${formatEmbargoDisplay(currentEmbargo)}`;
    wrapper.appendChild(display);
  }

  const btn = document.createElement('button');
  btn.className = 'pub-embargo-remove';
  btn.style.cssText =
    'border-color:var(--tmx-accent-blue); color:var(--tmx-accent-blue); padding:3px 10px; font-size:0.8rem;';
  btn.innerHTML = currentEmbargo
    ? `<i class="fa fa-pencil"></i> ${t('publishing.edit')}`
    : `<i class="fa fa-clock"></i> ${t('publishing.set')}`;
  btn.addEventListener('click', () => {
    openEmbargoModal({
      currentEmbargo,
      onSet: (isoString) => {
        mutationRequest({
          methods: [{ method: publishMethod, params: { embargo: isoString } }],
          callback: onRefresh,
        });
      },
      onClear: currentEmbargo
        ? () => {
            mutationRequest({
              methods: [{ method: publishMethod, params: { removePriorValues: true } }],
              callback: onRefresh,
            });
          }
        : undefined,
    });
  });
  wrapper.appendChild(btn);

  return wrapper;
}

export function renderTournamentControls(grid: HTMLElement): void {
  const data = getTournamentPublishData();
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  const publicUrl = tournamentId ? getPublicTournamentUrl(tournamentId) : undefined;
  const anythingPublished = isAnythingPublished();

  // Wrapper keeps all three panels in the left grid column (beside the QR panel)
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; flex-direction:column; gap:16px;';

  // ============================================================
  // Panel 1 — Tournament Publishing (language + unpublish)
  // ============================================================
  const topPanel = document.createElement('div');
  topPanel.className = 'pub-panel pub-panel-yellow';

  // Header row: title left, unpublish button right
  const topHeaderRow = document.createElement('div');
  topHeaderRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';

  const topHeader = document.createElement('h3');
  topHeader.style.margin = '0';
  topHeader.innerHTML = `<i class="fa fa-eye"></i> ${t('publishing.tournamentPublishing')}`;
  topHeaderRow.appendChild(topHeader);

  const unpublishBtn = barButton({
    label: `<i class="fa fa-eye-slash"></i>&nbsp;${t('publishing.unpublishTournament')}`,
    intent: 'is-danger',
    disabled: !anythingPublished,
  });
  unpublishBtn.style.cssText = 'flex-shrink:0;';

  unpublishBtn.onclick = () => {
    const onClick = () => {
      const methods: { method: string; params?: any }[] = [];

      const pubData = getTournamentPublishData();
      if (pubData.participantsPublished) {
        methods.push({ method: UNPUBLISH_PARTICIPANTS });
      }
      if (pubData.oopPublished) {
        methods.push({ method: UNPUBLISH_ORDER_OF_PLAY });
      }

      const tableData = getPublishingTableData();
      for (const row of tableData) {
        if (row.type === 'event' && row.published) {
          methods.push({ method: UNPUBLISH_EVENT, params: { eventId: row.eventId } });
        }
      }

      if (methods.length) {
        mutationRequest({ methods, callback: () => renderPublishingTab() });
      }
    };

    tmxToast({
      action: { onClick, text: t('publishing.confirmUnpublish') },
      message: t('publishing.unpublishTournament'),
      intent: 'is-danger',
      pauseOnHover: true,
      duration: 8000,
    });
  };

  topHeaderRow.appendChild(unpublishBtn);
  topPanel.appendChild(topHeaderRow);

  // Spacer between header and language selector
  const topSpacer = document.createElement('div');
  topSpacer.style.height = '8px';
  topPanel.appendChild(topSpacer);

  // Default Language selector (label rendered by renderForm above the select)
  const currentLang = data.publishLanguage || 'en';
  const langFormContainer = document.createElement('div');
  const langInputs = renderForm(langFormContainer, [
    {
      label: t('publishing.defaultLanguage'),
      field: 'language',
      options: SUPPORTED_LANGUAGES.map((lang) => ({
        ...lang,
        selected: lang.value === currentLang,
      })),
      onChange: () => {
        const selectedLang: string = langInputs.language?.value || 'en';
        const method = data.participantsPublished ? PUBLISH_PARTICIPANTS : PUBLISH_ORDER_OF_PLAY;
        mutationRequest({
          methods: [{ method, params: { language: selectedLang } }],
          callback: () => renderPublishingTab(),
        });
      },
    },
  ]);
  // Remove .field bottom margin
  const langField = langFormContainer.querySelector('.field') as HTMLElement;
  if (langField) langField.style.marginBottom = '0';
  topPanel.appendChild(langFormContainer);

  wrapper.appendChild(topPanel);

  // ============================================================
  // Panel 2 — Order of Play
  // ============================================================
  const oopPanel = document.createElement('div');
  oopPanel.className = 'pub-panel pub-panel-yellow';

  const oopHeader = document.createElement('h3');
  oopHeader.innerHTML = `<i class="fa fa-calendar"></i> ${t('publishing.orderOfPlay')}`;
  oopPanel.appendChild(oopHeader);

  const oopRow = document.createElement('div');
  oopRow.className = 'pub-toggle-row';
  oopRow.style.flexWrap = 'wrap';

  const oopState = data.oopPublished ? (data.oopEmbargoActive ? 'embargoed' : 'live') : 'off';
  const oopUrl = oopState === 'live' && publicUrl ? `${publicUrl}/schedule` : undefined;
  oopRow.appendChild(createStateBadge(oopState as 'live' | 'embargoed' | 'off', oopUrl));

  oopRow.appendChild(
    createToggle(data.oopPublished, (checked) => {
      const method = checked ? PUBLISH_ORDER_OF_PLAY : UNPUBLISH_ORDER_OF_PLAY;
      mutationRequest({ methods: [{ method }], callback: () => renderPublishingTab() });
    }),
  );

  oopRow.appendChild(
    createEmbargoButton(data.oopEmbargo, PUBLISH_ORDER_OF_PLAY, () => renderPublishingTab()),
  );

  // Per-date OOP chips
  if (data.tournamentDateRange.length > 0) {
    const dateSection = document.createElement('div');
    dateSection.style.cssText = 'width:100%; margin-top:8px;';

    const dateLabel = document.createElement('div');
    dateLabel.style.cssText = 'font-size:0.8rem; color:var(--tmx-text-secondary); margin-bottom:4px;';
    dateLabel.textContent = t('publishing.publishedDatesToggle');
    dateSection.appendChild(dateLabel);

    const dateGrid = document.createElement('div');
    dateGrid.className = 'pub-date-grid';

    const publishedDates = data.oopScheduledDates || [];

    for (const date of data.tournamentDateRange) {
      const chip = document.createElement('button');
      chip.className = 'pub-date-chip';
      if (publishedDates.includes(date)) chip.classList.add('active');
      chip.textContent = dayjs(date).format('ddd MMM D');

      chip.addEventListener('click', () => {
        const isPublished = chip.classList.contains('active');
        const currentDates = [...publishedDates];
        let newDates: string[];

        if (isPublished) {
          newDates = currentDates.filter((d) => d !== date);
        } else {
          newDates = [...currentDates, date];
        }

        mutationRequest({
          methods: [
            { method: PUBLISH_ORDER_OF_PLAY, params: { scheduledDates: newDates, removePriorValues: true } },
          ],
          callback: () => renderPublishingTab(),
        });
      });

      dateGrid.appendChild(chip);
    }

    dateSection.appendChild(dateGrid);
    oopRow.appendChild(dateSection);
  }

  oopPanel.appendChild(oopRow);
  wrapper.appendChild(oopPanel);

  // ============================================================
  // Panel 3 — Participant Publishing
  // ============================================================
  const partPanel = document.createElement('div');
  partPanel.className = 'pub-panel pub-panel-yellow';

  // Header row: title left, publish button right
  const partHeaderRow = document.createElement('div');
  partHeaderRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';

  const partHeader = document.createElement('h3');
  partHeader.style.margin = '0';
  partHeader.innerHTML = `<i class="fa fa-users"></i> ${t('publishing.participants')}`;
  partHeaderRow.appendChild(partHeader);

  // Publish Participants button in header (click handler wired up after columnInputs is created)
  const publishBtn = barButton({
    label: `<i class="fa fa-eye"></i>&nbsp;${t('publishing.publishParticipants')}`,
    intent: 'is-primary',
  });
  publishBtn.style.cssText = 'flex-shrink:0;';
  partHeaderRow.appendChild(publishBtn);
  partPanel.appendChild(partHeaderRow);

  const partSpacer = document.createElement('div');
  partSpacer.style.height = '8px';
  partPanel.appendChild(partSpacer);

  const partRow = document.createElement('div');
  partRow.className = 'pub-toggle-row';
  partRow.style.flexWrap = 'wrap';

  const partState = data.participantsPublished
    ? data.participantsEmbargoActive
      ? 'embargoed'
      : 'live'
    : 'off';
  partRow.appendChild(createStateBadge(partState as 'live' | 'embargoed' | 'off', partState === 'live' ? publicUrl : undefined));

  // Toggle controls visibility (and for unpublish, fires immediately)
  const partToggle = createToggle(data.participantsPublished, (checked) => {
    const method = checked ? PUBLISH_PARTICIPANTS : UNPUBLISH_PARTICIPANTS;
    mutationRequest({ methods: [{ method }], callback: () => renderPublishingTab() });
  });
  partRow.appendChild(partToggle);

  if (data.participantsPublished) {
    partRow.appendChild(
      createEmbargoButton(data.participantsEmbargo, PUBLISH_PARTICIPANTS, () => renderPublishingTab()),
    );
  }

  // Participant publish config controls (column multi-selector + publish button handler)
  {
    const configSection = document.createElement('div');
    configSection.style.cssText = 'width:100%; margin-top:8px;';

    // Discover available ratings and rankings from tournament participants
    const { participants: allParticipants = [] } =
      tournamentEngine.getParticipants({ withScaleValues: true }) ?? {};
    const discoveredRatings = new Set<string>();
    let hasRanking = false;
    for (const p of allParticipants as any[]) {
      for (const item of p.ratings?.[SINGLES] || []) {
        const upperName = item.scaleName?.toUpperCase();
        if (upperName && ratingsParameters[upperName]) discoveredRatings.add(upperName);
      }
      if (p.rankings?.[SINGLES]?.length) hasRanking = true;
    }

    // Determine current config from publish state
    const currentColumns = data.participantsColumns;

    // Build column options
    const columnOptions: { label: string; value: string; selected: boolean }[] = [
      {
        label: t('publishing.name') + ' (Country)',
        value: 'country',
        selected: currentColumns ? currentColumns.country !== false : true,
      },
      {
        label: t('publishing.event') + 's',
        value: 'events',
        selected: currentColumns ? currentColumns.events !== false : true,
      },
    ];
    if (hasRanking) {
      const rankingSelected = currentColumns?.rankings
        ? currentColumns.rankings.includes('SINGLES')
        : true;
      columnOptions.push({
        label: `Rank (SINGLES)`,
        value: 'ranking:SINGLES',
        selected: rankingSelected,
      });
    }
    for (const ratingName of [...discoveredRatings].sort()) {
      const ratingSelected = currentColumns?.ratings
        ? currentColumns.ratings.map((r) => r.toUpperCase()).includes(ratingName)
        : true;
      columnOptions.push({
        label: ratingName,
        value: `rating:${ratingName}`,
        selected: ratingSelected,
      });
    }

    const columnFormContainer = document.createElement('div');
    const columnInputs = renderForm(columnFormContainer, [
      {
        label: t('publishing.participantColumns'),
        field: 'columns',
        multiple: true,
        options: columnOptions,
      },
    ]);
    // Remove .field bottom margin
    const colField = columnFormContainer.querySelector('.field') as HTMLElement;
    if (colField) colField.style.marginBottom = '0';

    // Wire up publish button click handler now that columnInputs exists
    publishBtn.addEventListener('click', () => {
      const selectedValues: string[] = columnInputs.columns?.selectedValues || [];

      const columns: any = {
        country: selectedValues.includes('country'),
        events: selectedValues.includes('events'),
        ratings: selectedValues.filter((v) => v.startsWith('rating:')).map((v) => v.split(':')[1]),
        rankings: selectedValues.filter((v) => v.startsWith('ranking:')).map((v) => v.split(':')[1]),
      };

      mutationRequest({
        methods: [{ method: PUBLISH_PARTICIPANTS, params: { columns } }],
        callback: () => renderPublishingTab(),
      });
    });

    configSection.appendChild(columnFormContainer);
    partRow.appendChild(configSection);
  }

  partPanel.appendChild(partRow);
  wrapper.appendChild(partPanel);

  grid.appendChild(wrapper);
}
