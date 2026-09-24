/**
 * Tournament-level publishing controls: Information + Participants + Order of Play.
 * Includes publish toggles, embargo buttons (open modal), and per-date OOP selection.
 */
import { buildOrderOfPlayDateToggleMethods } from 'services/publishing/orderOfPlayPublish';
import { renderPublishingTab, isAnythingPublished } from './renderPublishingTab';
import { getPublicTournamentUrl } from 'services/publishing/publicUrl';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { eventConstants, fixtures } from 'tods-competition-factory';
import { barButton, renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { venueTimeZone } from 'functions/venueTimeFrame';
import { providerConfig } from 'config/providerConfig';
import { openEmbargoModal } from './embargoModal';
import dayjs from 'dayjs';
import { t } from 'i18n';
import {
  getTournamentPublishData,
  getPublishingTableData,
  infoScopeParams,
  resolvePublishState,
} from './publishingData';

import {
  UNPUBLISH_TOURNAMENT_INFO,
  PUBLISH_TOURNAMENT_INFO,
  UNPUBLISH_ORDER_OF_PLAY,
  UNPUBLISH_PARTICIPANTS,
  PUBLISH_ORDER_OF_PLAY,
  PUBLISH_PARTICIPANTS,
  UNPUBLISH_EVENT,
} from 'constants/mutationConstants';

const { ratingsParameters } = fixtures;
const PUB_PANEL_YELLOW = 'pub-panel pub-panel-yellow';
const PUB_TOGGLE_ROW = 'pub-toggle-row';
const PUB_CONFIG_SECTION = 'width:100%; margin-top:8px;';
const { SINGLES } = eventConstants;

const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'pt-BR', label: 'Português' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ar', label: 'العربية' },
  { value: 'zh-CN', label: '简体中文' },
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
    // The embargo is a tournament decision, so it displays on the venue's clock.
    timeZone: venueTimeZone(),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * `clearParams` exists because clearing an embargo is a RE-PUBLISH, and what else rides on that call
 * differs by surface. Order of play and participants clear with `removePriorValues`, which is safe
 * because the embargo is the only thing they carry. The information publish also carries its EVENT
 * SCOPE, and the write replaces `info` wholesale rather than merging — so clearing with
 * `removePriorValues` would silently widen the information page to every event. It passes its
 * current scope instead.
 */
function createEmbargoButton(
  currentEmbargo: string | undefined,
  publishMethod: string,
  onRefresh: () => void,
  params?: { setParams?: () => Record<string, any>; clearParams?: () => Record<string, any> },
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
          methods: [{ method: publishMethod, params: { ...(params?.setParams?.() ?? {}), embargo: isoString } }],
          callback: onRefresh,
        });
      },
      onClear: currentEmbargo
        ? () => {
            mutationRequest({
              methods: [{ method: publishMethod, params: params?.clearParams?.() ?? { removePriorValues: true } }],
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
  const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
  const publicUrl = tournamentId ? getPublicTournamentUrl(tournamentId) : undefined;
  const anythingPublished = isAnythingPublished();

  // Wrapper keeps all three panels in the left grid column (beside the QR panel)
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; flex-direction:column; gap:16px;';

  // ============================================================
  // Panel 1 — Tournament Publishing (language + unpublish)
  // ============================================================
  const topPanel = document.createElement('div');
  topPanel.className = PUB_PANEL_YELLOW;

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
      if (pubData.infoPublished) {
        methods.push({ method: UNPUBLISH_TOURNAMENT_INFO });
      }
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

  wrapper.appendChild(buildInformationPanel(data, publicUrl));

  wrapper.appendChild(buildOopPanel(data, publicUrl));

  wrapper.appendChild(buildParticipantsPanel(data, publicUrl));

  grid.appendChild(wrapper);
}

/**
 * Tournament INFORMATION — the tournament itself, published before anything inside it.
 *
 * Every other publish needs something to exist first: an event needs a draw, the order of play a
 * schedule, the participant list entries. This is what makes a tournament public during its
 * registration phase — listed, with an information page and its event list — and it is why the panel
 * sits above the others rather than beside them.
 *
 * Publishing information does NOT open registration: that is `registrationProfile.entriesOpen` /
 * `entriesClose`, edited on the overview tab, and this never touches them.
 */
function buildInformationPanel(data: any, publicUrl: string | undefined): HTMLElement {
  const infoPanel = document.createElement('div');
  infoPanel.className = PUB_PANEL_YELLOW;

  const infoHeader = document.createElement('h3');
  infoHeader.innerHTML = `<i class="fa fa-circle-info"></i> ${t('publishing.tournamentInformation')}`;
  infoPanel.appendChild(infoHeader);

  const infoRow = document.createElement('div');
  infoRow.className = PUB_TOGGLE_ROW;
  infoRow.style.flexWrap = 'wrap';

  // The badge distinguishes three states, not two, because since P23 D4b "published" and "visible"
  // can differ: an information publish carrying a future embargo is PUBLISHED — the toggle is on —
  // and absent from every public listing until the date arrives. Showing it as `live` would be a
  // lie the director acts on; showing it as `off` would be a different one.
  // `resolvePublishState` is the SAME three-way decision the event rows already use — reached for
  // rather than restated, because a second copy of "published vs withheld vs off" is how the publish
  // model grew three definitions in the first place (P23).
  const infoState = resolvePublishState(data.infoPublished, data.infoEmbargo);
  const infoEmbargoPending = infoState === 'embargoed';
  infoRow.appendChild(createStateBadge(infoState, infoState === 'live' ? publicUrl : undefined));

  let eventInputs: any;

  infoRow.appendChild(
    createToggle(data.infoPublished, (checked) => {
      if (checked) {
        const selected: string[] = eventInputs?.infoEvents?.selectedValues ?? [];
        mutationRequest({
          methods: [{ method: PUBLISH_TOURNAMENT_INFO, params: infoScopeParams(selected, allEventIds()) }],
          callback: () => renderPublishingTab(),
        });
      } else {
        mutationRequest({ methods: [{ method: UNPUBLISH_TOURNAMENT_INFO }], callback: () => renderPublishingTab() });
      }
    }),
  );

  const { eventFormContainer, inputs } = buildInformationEventSelector(data);
  eventInputs = inputs;

  // Offered whether or not information is published yet, like the order-of-play panel — and that is
  // the whole point rather than a cosmetic consistency. Setting an embargo PUBLISHES with it, in one
  // mutation, so the tournament goes from unpublished straight to published-and-withheld. Gating the
  // control on `infoPublished` (as this panel first did, and as the participants panel did) forces a
  // director to publish FIRST and embargo second, which makes the tournament briefly visible to the
  // public — precisely what the embargo exists to prevent.
  const currentScope = () => infoScopeParams(eventInputs?.infoEvents?.selectedValues ?? [], allEventIds());
  infoRow.appendChild(
    createEmbargoButton(data.infoEmbargo, PUBLISH_TOURNAMENT_INFO, () => renderPublishingTab(), {
      setParams: currentScope,
      // NOT `removePriorValues`: the information publish replaces `info` wholesale, so clearing the
      // embargo without restating the scope would widen the page to every event.
      clearParams: currentScope,
    }),
  );

  if (eventFormContainer) {
    const scopeSection = document.createElement('div');
    scopeSection.style.cssText = PUB_CONFIG_SECTION;
    scopeSection.appendChild(eventFormContainer);
    infoRow.appendChild(scopeSection);
  }

  infoPanel.appendChild(infoRow);
  // AFTER the control row: the note explains what the badge and toggle above it mean, and inserting
  // it between the header and the row would also displace the row every other panel keeps first.
  if (infoEmbargoPending) infoPanel.appendChild(buildEmbargoExplainer(data.infoEmbargo));

  return infoPanel;
}

/**
 * One line telling the director what the panel would otherwise leave them to infer: the tournament is
 * published and still not listed anywhere, and when that changes. Without it the panel reads as broken
 * — the toggle is on, and the public site shows nothing.
 */
function buildEmbargoExplainer(embargo: string): HTMLElement {
  const note = document.createElement('div');
  note.style.cssText = 'font-size:0.8rem; color:var(--tmx-text-secondary); margin-top:6px;';
  note.innerHTML = `<i class="fa fa-eye-slash"></i> ${t('publishing.informationEmbargoNote', {
    when: formatEmbargoDisplay(embargo),
  })}`;
  return note;
}

function allEventIds(): string[] {
  return ((tournamentEngine.q.events() ?? []) as any[]).map((event) => event.eventId);
}

function buildInformationEventSelector(data: any): { eventFormContainer?: HTMLElement; inputs: any } {
  const events = (tournamentEngine.q.events() ?? []) as any[];
  if (!events.length) return { inputs: undefined };

  // No stored scope means every event, which is what the factory does with an absent `eventIds`.
  const scoped: string[] | undefined = data.infoEventIds;
  const options = events.map((event) => ({
    label: event.eventName ?? event.eventId,
    value: event.eventId,
    selected: !scoped || scoped.includes(event.eventId),
  }));

  const eventFormContainer = document.createElement('div');
  const inputs = renderForm(eventFormContainer, [
    {
      label: t('publishing.informationEvents'),
      field: 'infoEvents',
      multiple: true,
      options,
      onChange: () => {
        if (!data.infoPublished) return undefined;
        const selected: string[] = inputs.infoEvents?.selectedValues ?? [];
        mutationRequest({
          methods: [{ method: PUBLISH_TOURNAMENT_INFO, params: infoScopeParams(selected, allEventIds()) }],
        });
      },
    },
  ]);
  const eventField = eventFormContainer.querySelector('.field') as HTMLElement;
  if (eventField) eventField.style.marginBottom = '0';

  return { eventFormContainer, inputs };
}

function buildOopPanel(data: any, publicUrl: string | undefined): HTMLElement {
  const oopPanel = document.createElement('div');
  oopPanel.className = PUB_PANEL_YELLOW;

  const oopHeader = document.createElement('h3');
  oopHeader.innerHTML = `<i class="fa fa-calendar"></i> ${t('publishing.orderOfPlay')}`;
  oopPanel.appendChild(oopHeader);

  const oopRow = document.createElement('div');
  oopRow.className = PUB_TOGGLE_ROW;
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

  oopRow.appendChild(createEmbargoButton(data.oopEmbargo, PUBLISH_ORDER_OF_PLAY, () => renderPublishingTab()));

  if (data.tournamentDateRange.length > 0) {
    oopRow.appendChild(buildOopDateChips(data));
  }

  oopPanel.appendChild(oopRow);
  return oopPanel;
}

function buildOopDateChips(data: any): HTMLElement {
  const dateSection = document.createElement('div');
  dateSection.style.cssText = PUB_CONFIG_SECTION;

  const dateLabel = document.createElement('div');
  dateLabel.style.cssText = 'font-size:0.8rem; color:var(--tmx-text-secondary); margin-bottom:4px;';
  dateLabel.textContent = t('publishing.publishedDatesToggle');
  dateSection.appendChild(dateLabel);

  const dateGrid = document.createElement('div');
  dateGrid.className = 'pub-date-grid';

  const publishedDates = data.oopScheduledDates || [];
  const allDatesPublished = data.oopPublished && publishedDates.length === 0;

  for (const date of data.tournamentDateRange) {
    const chip = document.createElement('button');
    chip.className = 'pub-date-chip';
    if (allDatesPublished || publishedDates.includes(date)) chip.classList.add('active');
    chip.textContent = dayjs(date).format('ddd MMM D');

    chip.addEventListener('click', () => {
      const { methods } = buildOrderOfPlayDateToggleMethods(date, data.tournamentDateRange, {
        published: data.oopPublished,
        allPublished: allDatesPublished,
        publishedDates,
      });
      mutationRequest({ methods, callback: () => renderPublishingTab() });
    });

    dateGrid.appendChild(chip);
  }

  dateSection.appendChild(dateGrid);
  return dateSection;
}

function extractColumnsFromSelection(selectedValues: string[]): any {
  return {
    country: selectedValues.includes('country'),
    cityState: selectedValues.includes('cityState'),
    events: selectedValues.includes('events'),
    ratings: selectedValues.filter((v: string) => v.startsWith('rating:')).map((v: string) => v.split(':')[1]),
    rankings: selectedValues.filter((v: string) => v.startsWith('ranking:')).map((v: string) => v.split(':')[1]),
  };
}

function buildParticipantsPanel(data: any, publicUrl: string | undefined): HTMLElement {
  const partPanel = document.createElement('div');
  partPanel.className = PUB_PANEL_YELLOW;

  const partHeader = document.createElement('h3');
  partHeader.innerHTML = `<i class="fa fa-users"></i> ${t('publishing.participants')}`;
  partPanel.appendChild(partHeader);

  const partRow = document.createElement('div');
  partRow.className = PUB_TOGGLE_ROW;
  partRow.style.flexWrap = 'wrap';

  const partState = data.participantsPublished ? (data.participantsEmbargoActive ? 'embargoed' : 'live') : 'off';
  partRow.appendChild(
    createStateBadge(partState as 'live' | 'embargoed' | 'off', partState === 'live' ? publicUrl : undefined),
  );

  let columnInputs: any;

  const partToggle = createToggle(data.participantsPublished, (checked) => {
    if (checked) {
      const selectedValues: string[] = columnInputs?.columns?.selectedValues || [];
      const columns = extractColumnsFromSelection(selectedValues);
      mutationRequest({
        methods: [{ method: PUBLISH_PARTICIPANTS, params: { columns } }],
        callback: () => renderPublishingTab(),
      });
    } else {
      mutationRequest({ methods: [{ method: UNPUBLISH_PARTICIPANTS }], callback: () => renderPublishingTab() });
    }
  });
  partRow.appendChild(partToggle);

  // Unconditional, for the same reason as information above: publishing first in order to embargo
  // second exposes the participant list in the window between the two.
  partRow.appendChild(createEmbargoButton(data.participantsEmbargo, PUBLISH_PARTICIPANTS, () => renderPublishingTab()));

  const { columnFormContainer, inputs } = buildColumnSelector(data);
  columnInputs = inputs;
  const configSection = document.createElement('div');
  configSection.style.cssText = PUB_CONFIG_SECTION;
  configSection.appendChild(columnFormContainer);
  partRow.appendChild(configSection);

  partPanel.appendChild(partRow);
  return partPanel;
}

function buildColumnSelector(data: any): { columnFormContainer: HTMLElement; inputs: any } {
  const { participants: allParticipants = [] } = tournamentEngine.getParticipants({ withScaleValues: true }) ?? {};
  const discoveredRatings = new Set<string>();
  let hasRanking = false;
  for (const p of allParticipants as any[]) {
    for (const item of p.ratings?.[SINGLES] || []) {
      const upperName = item.scaleName?.toUpperCase();
      if (upperName && ratingsParameters[upperName]) discoveredRatings.add(upperName);
    }
    if (p.rankings?.[SINGLES]?.length) hasRanking = true;
  }

  const currentColumns = data.participantsColumns;

  const columnOptions: { label: string; value: string; selected: boolean; disabled?: boolean }[] = [
    {
      label: t('publishing.name'),
      value: 'name',
      selected: true,
      disabled: true,
    },
    {
      label: t('publishing.country'),
      value: 'country',
      selected: currentColumns ? currentColumns.country !== false : false,
    },
    {
      label: t('publishing.event') + 's',
      value: 'events',
      selected: currentColumns ? currentColumns.events !== false : false,
    },
  ];

  // City / State publish-column toggle is gated on the provider's
  // `participantPrivacy.cityState` cap. The server's privacy policy
  // would strip addresses anyway when the cap is off, so showing the
  // toggle would be misleading.
  if (providerConfig.get().participantPrivacy?.cityState) {
    columnOptions.push({
      label: t('publishing.cityState'),
      value: 'cityState',
      selected: currentColumns ? currentColumns.cityState !== false : false,
    });
  }
  if (hasRanking) {
    const rankingSelected = currentColumns?.rankings ? currentColumns.rankings.includes('SINGLES') : false;
    columnOptions.push({
      label: t('registrations.rankSingles'),
      value: 'ranking:SINGLES',
      selected: rankingSelected,
    });
  }
  for (const ratingName of [...discoveredRatings].sort()) {
    const ratingSelected = currentColumns?.ratings
      ? currentColumns.ratings.map((r) => r.toUpperCase()).includes(ratingName)
      : false;
    columnOptions.push({
      label: ratingName,
      value: `rating:${ratingName}`,
      selected: ratingSelected,
    });
  }

  const columnFormContainer = document.createElement('div');
  const inputs = renderForm(columnFormContainer, [
    {
      label: t('publishing.participantColumns'),
      field: 'columns',
      multiple: true,
      options: columnOptions,
      onChange: () => {
        if (!data.participantsPublished) return;
        const selectedValues: string[] = inputs.columns?.selectedValues || [];
        const columns = extractColumnsFromSelection(selectedValues);
        mutationRequest({
          methods: [{ method: PUBLISH_PARTICIPANTS, params: { columns } }],
        });
      },
    },
  ]);
  const colField = columnFormContainer.querySelector('.field') as HTMLElement;
  if (colField) colField.style.marginBottom = '0';

  return { columnFormContainer, inputs };
}
