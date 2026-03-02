/**
 * Active embargoes summary section.
 * Displays all active embargoes sorted by expiry with remove buttons.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderPublishingTab } from './renderPublishingTab';
import { getActiveEmbargoes } from './publishingData';
import { tournamentEngine, publishingGovernor } from 'tods-competition-factory';
import { t } from 'i18n';

// constants
import { PUBLISH_EVENT, PUBLISH_ORDER_OF_PLAY, PUBLISH_PARTICIPANTS } from 'constants/mutationConstants';

function formatEmbargoTime(isoString: string): { display: string; countdown: string } {
  const date = new Date(isoString);
  const display = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const diff = date.getTime() - Date.now();
  if (diff <= 0) return { display, countdown: t('publishing.expired') };

  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const countdown = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return { display, countdown };
}

function removeEmbargo(entry: ReturnType<typeof getActiveEmbargoes>[0]): void {
  if (entry.type === 'orderOfPlay') {
    mutationRequest({
      methods: [{ method: PUBLISH_ORDER_OF_PLAY, params: { removePriorValues: true } }],
      callback: () => renderPublishingTab(),
    });
  } else if (entry.type === 'participants') {
    mutationRequest({
      methods: [{ method: PUBLISH_PARTICIPANTS, params: { removePriorValues: true } }],
      callback: () => renderPublishingTab(),
    });
  } else if (entry.type === 'draw' && entry.eventId && entry.drawId) {
    const drawDetails: Record<string, any> = {};
    drawDetails[entry.drawId] = {
      publishingDetail: { published: true },
    };
    mutationRequest({
      methods: [
        {
          method: PUBLISH_EVENT,
          params: {
            eventId: entry.eventId,
            drawIdsToAdd: [entry.drawId],
            drawDetails,
          },
        },
      ],
      callback: () => renderPublishingTab(),
    });
  } else if (entry.type === 'scheduledRound' && entry.eventId && entry.drawId && entry.structureId && entry.roundNumber) {
    const { event } = tournamentEngine.getEvent({ drawId: entry.drawId });
    if (!event) return;

    const pubState = publishingGovernor.getPublishState({ event })?.publishState;
    const drawDetail = pubState?.status?.drawDetails?.[entry.drawId] || {};
    const existingStructureDetails = drawDetail.structureDetails || {};
    const existingDetail = existingStructureDetails[entry.structureId] || {};
    const existingScheduledRounds = existingDetail.scheduledRounds || {};

    const scheduledRounds = {
      ...existingScheduledRounds,
      [entry.roundNumber]: { published: true },
    };
    const structureDetails = {
      ...existingStructureDetails,
      [entry.structureId]: { ...existingDetail, scheduledRounds },
    };

    mutationRequest({
      methods: [
        {
          method: PUBLISH_EVENT,
          params: {
            removePriorValues: true,
            drawDetails: { [entry.drawId]: { ...drawDetail, structureDetails } },
            eventId: entry.eventId,
          },
        },
      ],
      callback: () => renderPublishingTab(),
    });
  }
}

export function renderEmbargoSummary(grid: HTMLElement): void {
  const embargoes = getActiveEmbargoes();

  const panel = document.createElement('div');
  panel.className = 'pub-panel pub-panel-orange pub-grid-full';

  const header = document.createElement('h3');
  header.innerHTML = `<i class="fa fa-clock"></i> ${t('publishing.activeEmbargoes')} (${embargoes.length})`;
  panel.appendChild(header);

  if (embargoes.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:0.85rem; color:var(--tmx-text-muted); font-style:italic;';
    empty.textContent = t('publishing.noActiveEmbargoes');
    panel.appendChild(empty);
  } else {
    for (const entry of embargoes) {
      const expired = !entry.embargoActive;
      const row = document.createElement('div');
      row.className = `pub-embargo-row${expired ? ' pub-embargo-row--expired' : ''}`;

      const typeEl = document.createElement('span');
      typeEl.className = 'pub-embargo-type';
      typeEl.textContent = entry.label;
      row.appendChild(typeEl);

      if (expired) {
        const badge = document.createElement('span');
        badge.className = 'pub-embargo-expired-badge';
        badge.textContent = t('publishing.expired');
        row.appendChild(badge);
      }

      const { display, countdown } = formatEmbargoTime(entry.embargo);
      const timeEl = document.createElement('span');
      timeEl.className = 'pub-embargo-time';
      timeEl.textContent = expired ? display : `${display} (${countdown})`;
      row.appendChild(timeEl);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'pub-embargo-remove';
      removeBtn.innerHTML = `<i class="fa fa-xmark"></i> ${t('publishing.remove')}`;
      removeBtn.addEventListener('click', () => removeEmbargo(entry));
      row.appendChild(removeBtn);

      panel.appendChild(row);
    }
  }

  grid.appendChild(panel);
}
