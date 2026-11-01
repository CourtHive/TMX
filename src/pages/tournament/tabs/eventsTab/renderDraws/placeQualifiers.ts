/**
 * "Place qualifiers": draws every qualified participant by lot into the main draw's open qualifier positions, then
 * tells the TD who went where and whether any qualifier or position was left over.
 *
 * The rules live in `qualifierPlacement.ts`; this module only asks, sends and reports.
 */
import { confirmModal, openModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';
import {
  buildPlaceQualifiersMethod,
  getQualifierPlacementState,
  summarizeQualifierPlacement,
} from './qualifierPlacement';

type PlaceQualifiersParams = {
  onPlaced: () => void;
  eventId: string;
  drawId: string;
};

export function placeQualifiers({ drawId, eventId, onPlaced }: PlaceQualifiersParams) {
  const state = getQualifierPlacementState({ engine: tournamentEngine, drawId, eventId });
  if (!state.eligible) {
    tmxToast({ message: t('pages.events.placeQualifiers.nothingToPlace'), intent: 'is-warning' });
    return;
  }

  const qualifiedCount = state.qualifiedParticipantIds.length;
  const positionsCount = state.openQualifierPositions.length;

  const okAction = () => {
    const method = buildPlaceQualifiersMethod({ positionsCount, eventId, drawId });
    mutationRequest({
      methods: [method],
      callback: (result: any) => {
        if (!result?.success) {
          tmxToast({
            message: result?.error?.message || t('pages.events.placeQualifiers.failed'),
            intent: 'is-danger',
          });
          return;
        }
        const summary = summarizeQualifierPlacement({
          qualifiedParticipantIds: state.qualifiedParticipantIds,
          getName: participantName,
          positionsCount,
          result,
        });
        onPlaced();
        showSummary(summary);
      },
    });
  };

  confirmModal({
    title: t('pages.events.placeQualifiers.title'),
    query: t('pages.events.placeQualifiers.confirm', { qualifiedCount, positionsCount }),
    okIntent: 'is-info',
    okAction,
  });
}

function participantName(participantId: string): string | undefined {
  return tournamentEngine.getParticipants({ participantFilters: { participantIds: [participantId] } })
    ?.participants?.[0]?.participantName;
}

function showSummary(summary: ReturnType<typeof summarizeQualifierPlacement>) {
  const content = (elem: HTMLElement) => {
    const intro = document.createElement('p');
    intro.style.color = 'var(--tmx-text-primary)';
    intro.textContent = summary.placed.length
      ? t('pages.events.placeQualifiers.placedCount', { count: summary.placed.length })
      : t('pages.events.placeQualifiers.nonePlaced');
    elem.appendChild(intro);

    if (summary.placed.length) {
      const list = document.createElement('ul');
      list.style.cssText = 'margin: .5em 0 0 1.25em; list-style: disc; color: var(--tmx-text-primary);';
      for (const { participantName, drawPosition } of summary.placed) {
        const item = document.createElement('li');
        item.textContent = t('pages.events.placeQualifiers.placedAt', { name: participantName, drawPosition });
        list.appendChild(item);
      }
      elem.appendChild(list);
    }

    if (summary.incomplete) {
      const warning = document.createElement('p');
      warning.style.cssText = 'margin-top: .75em; color: var(--tmx-accent-orange);';
      const parts: string[] = [];
      if (summary.notPlaced.length) {
        const names = summary.notPlaced.map(({ participantName }) => participantName).join(', ');
        parts.push(t('pages.events.placeQualifiers.notPlaced', { count: summary.notPlaced.length, names }));
      }
      if (summary.openPositionsRemaining) {
        parts.push(t('pages.events.placeQualifiers.positionsOpen', { count: summary.openPositionsRemaining }));
      }
      warning.textContent = parts.join(' ');
      elem.appendChild(warning);
    }
  };

  openModal({
    title: t('pages.events.placeQualifiers.title'),
    buttons: [{ label: t('ui.ok'), intent: 'is-info', close: true }],
    content,
  });
}
