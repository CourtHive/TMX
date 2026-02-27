/**
 * Active embargoes summary section.
 * Displays all active embargoes sorted by expiry with remove buttons.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getActiveEmbargoes } from './publishingData';
import { renderPublishingTab } from './renderPublishingTab';
import { t } from 'i18n';

import {
  PUBLISH_EVENT,
  PUBLISH_ORDER_OF_PLAY,
  PUBLISH_PARTICIPANTS,
} from 'constants/mutationConstants';

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
      const row = document.createElement('div');
      row.className = 'pub-embargo-row';

      const typeEl = document.createElement('span');
      typeEl.className = 'pub-embargo-type';
      typeEl.textContent = entry.label;
      row.appendChild(typeEl);

      const { display, countdown } = formatEmbargoTime(entry.embargo);
      const timeEl = document.createElement('span');
      timeEl.className = 'pub-embargo-time';
      timeEl.textContent = `${display} (${countdown})`;
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
