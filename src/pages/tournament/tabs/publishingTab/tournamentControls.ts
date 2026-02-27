/**
 * Tournament-level publishing controls: Participants + Order of Play.
 * Includes publish toggles, embargo buttons (open modal), and per-date OOP selection.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getPublicTournamentUrl } from 'services/publishing/publicUrl';
import { getTournamentPublishData } from './publishingData';
import { openEmbargoModal } from './embargoModal';
import { renderPublishingTab } from './renderPublishingTab';
import { tournamentEngine } from 'tods-competition-factory';
import { t } from 'i18n';
import dayjs from 'dayjs';

import {
  PUBLISH_ORDER_OF_PLAY,
  UNPUBLISH_ORDER_OF_PLAY,
  PUBLISH_PARTICIPANTS,
  UNPUBLISH_PARTICIPANTS,
} from 'constants/mutationConstants';

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

  const panel = document.createElement('div');
  panel.className = 'pub-panel pub-panel-yellow';

  const header = document.createElement('h3');
  header.innerHTML = `<i class="fa fa-eye"></i> ${t('publishing.tournamentPublishing')}`;
  panel.appendChild(header);

  // --- Participants row ---
  const partRow = document.createElement('div');
  partRow.className = 'pub-toggle-row';

  const partLabel = document.createElement('span');
  partLabel.className = 'pub-label';
  partLabel.textContent = t('publishing.participants');
  partRow.appendChild(partLabel);

  const partState = data.participantsPublished
    ? data.participantsEmbargoActive
      ? 'embargoed'
      : 'live'
    : 'off';
  partRow.appendChild(createStateBadge(partState as 'live' | 'embargoed' | 'off', partState === 'live' ? publicUrl : undefined));

  partRow.appendChild(
    createToggle(data.participantsPublished, (checked) => {
      const method = checked ? PUBLISH_PARTICIPANTS : UNPUBLISH_PARTICIPANTS;
      mutationRequest({ methods: [{ method }], callback: () => renderPublishingTab() });
    }),
  );

  partRow.appendChild(
    createEmbargoButton(data.participantsEmbargo, PUBLISH_PARTICIPANTS, () => renderPublishingTab()),
  );

  panel.appendChild(partRow);

  // --- Order of Play row ---
  const oopRow = document.createElement('div');
  oopRow.className = 'pub-toggle-row';
  oopRow.style.flexWrap = 'wrap';

  const oopLabel = document.createElement('span');
  oopLabel.className = 'pub-label';
  oopLabel.textContent = t('publishing.orderOfPlay');
  oopRow.appendChild(oopLabel);

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

  panel.appendChild(oopRow);

  grid.appendChild(panel);
}
