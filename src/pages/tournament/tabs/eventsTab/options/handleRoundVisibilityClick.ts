/**
 * Handle round visibility click from draw view.
 * Shows tipster menu with options to toggle round visibility (AD_HOC)
 * and set/clear round schedule embargo (all draw types).
 */
import { tournamentEngine, publishingGovernor } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openEmbargoModal } from '../../publishingTab/embargoModal';
import { tipster } from 'components/popovers/tipster';
import { t } from 'i18n';

import { PUBLISH_EVENT } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

const eventDataParams = {
  participantsProfile: { withScaleValues: true },
  pressureRating: true,
  refreshResults: true,
};

export function handleRoundVisibilityClick(props: any): void {
  const { structureId, drawId, roundNumber, callback } = props;
  const { event } = tournamentEngine.getEvent({ drawId });
  if (!event) return;

  const eventId = event.eventId;
  const drawDefinition = event.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
  const structure = drawDefinition?.structures?.find((s: any) => s.structureId === structureId);
  const isAdHoc = tournamentEngine.isAdHoc({ structure });

  // Get current publish state for this structure
  const pubState = publishingGovernor.getPublishState({ event })?.publishState;
  const drawDetail = pubState?.status?.drawDetails?.[drawId];
  const structureDetail = drawDetail?.structureDetails?.[structureId] || {};
  const currentRoundLimit = structureDetail.roundLimit;
  const currentScheduledRounds = structureDetail.scheduledRounds || {};

  // Compute max round number from matchUps in this structure
  const matchUps =
    tournamentEngine.allDrawMatchUps({
      matchUpFilters: { structureIds: [structureId] },
      drawId,
    }).matchUps || [];
  const maxRound = matchUps.reduce((max: number, m: any) => Math.max(max, m.roundNumber || 0), 0);

  const items: any[] = [];

  // Option 1: Round visibility (roundLimit) — AD_HOC only
  if (isAdHoc) {
    const isHidden = currentRoundLimit != null && roundNumber > currentRoundLimit;
    items.push({
      text: isHidden
        ? t('publishing.showRound', { roundNumber })
        : t('publishing.hideRound', { roundNumber }),
      icon: isHidden ? 'fa-eye' : 'fa-eye-slash',
      onClick: () => {
        const newLimit = isHidden ? Math.max(roundNumber, currentRoundLimit || 0) : roundNumber - 1;
        const updatedStructureDetail: any = {
          ...structureDetail,
          published: true,
        };
        if (newLimit >= 0 && newLimit < maxRound) {
          updatedStructureDetail.roundLimit = newLimit;
        } else {
          delete updatedStructureDetail.roundLimit;
        }

        mutationRequest({
          methods: [
            {
              method: PUBLISH_EVENT,
              params: {
                removePriorValues: true,
                drawDetails: {
                  [drawId]: {
                    structureDetails: { [structureId]: updatedStructureDetail },
                  },
                },
                eventId,
                eventDataParams,
              },
            },
          ],
          callback: () => callback?.({ refresh: true }),
        });
      },
    });
  }

  // Option 2: Schedule embargo for this round — all draw types
  const roundEmbargoDetail = currentScheduledRounds[roundNumber];
  const hasEmbargo = !!(roundEmbargoDetail?.embargo && new Date(roundEmbargoDetail.embargo).getTime() > Date.now());

  items.push({
    text: hasEmbargo
      ? t('publishing.clearRoundScheduleEmbargo', { roundNumber })
      : t('publishing.embargoRoundSchedule', { roundNumber }),
    icon: 'fa-calendar',
    onClick: () => {
      if (hasEmbargo) {
        // Clear embargo
        const scheduledRounds = { ...currentScheduledRounds, [roundNumber]: { published: true } };
        mutationRequest({
          methods: [
            {
              method: PUBLISH_EVENT,
              params: {
                removePriorValues: true,
                drawDetails: {
                  [drawId]: {
                    structureDetails: { [structureId]: { ...structureDetail, scheduledRounds } },
                  },
                },
                eventId,
                eventDataParams,
              },
            },
          ],
          callback: () => callback?.({ refresh: true }),
        });
      } else {
        // Open embargo modal
        openEmbargoModal({
          title: t('publishing.embargoRoundSchedule', { roundNumber }),
          currentEmbargo: roundEmbargoDetail?.embargo,
          onSet: (isoString) => {
            const scheduledRounds = {
              ...currentScheduledRounds,
              [roundNumber]: { published: true, embargo: isoString },
            };
            mutationRequest({
              methods: [
                {
                  method: PUBLISH_EVENT,
                  params: {
                    removePriorValues: true,
                    drawDetails: {
                      [drawId]: {
                        structureDetails: { [structureId]: { ...structureDetail, scheduledRounds } },
                      },
                    },
                    eventId,
                    eventDataParams,
                  },
                },
              ],
              callback: () => callback?.({ refresh: true }),
            });
          },
        });
      }
    },
  });

  if (props?.pointerEvent && items.length) {
    tipster({ items, target: props.pointerEvent.target, config: { placement: BOTTOM } });
  }
}
