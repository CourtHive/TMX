/**
 * Handle round visibility click from draw view.
 * Shows tipster menu with options to toggle round visibility (AD_HOC)
 * and set/clear round schedule embargo (all draw types).
 */
import { setRoundScheduleEmbargo, setStructureRoundLimit } from '../../publishingTab/structurePublishing';
import { openEmbargoModal } from '../../publishingTab/embargoModal';
import { publishingGovernor } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { tipster } from 'components/popovers/tipster';
import { t } from 'i18n';

import { BOTTOM } from 'constants/tmxConstants';

export function handleRoundVisibilityClick(props: any): void {
  const { structureId, drawId, roundNumber, callback } = props;
  const { event } = tournamentEngine.getEvent({ drawId });
  if (!event) return undefined;

  const eventId = event.eventId;
  // Every write goes through publishStructureDetails, which sends the draw's FULL structureDetails:
  // a one-structure map hid every sibling structure (a qualifying draw's MAIN) from the public.
  const target = { eventId, drawId, structureId, callback: () => callback?.({ refresh: true }) };
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
      text: isHidden ? t('publishing.showRound', { roundNumber }) : t('publishing.hideRound', { roundNumber }),
      icon: isHidden ? 'fa-eye' : 'fa-eye-slash',
      onClick: () => {
        const newLimit = isHidden ? Math.max(roundNumber, currentRoundLimit || 0) : roundNumber - 1;
        setStructureRoundLimit({
          roundLimit: newLimit >= 0 && newLimit < maxRound ? newLimit : undefined,
          ...target,
        });
      },
    });
  }

  // Option 2: Schedule embargo for this round — all draw types
  const roundEmbargoDetail = currentScheduledRounds[roundNumber];
  const hasEmbargo = publishingGovernor.isEmbargoed(roundEmbargoDetail);

  items.push({
    text: hasEmbargo
      ? t('publishing.clearRoundScheduleEmbargo', { roundNumber })
      : t('publishing.embargoRoundSchedule', { roundNumber }),
    icon: 'fa-calendar',
    onClick: () => {
      if (hasEmbargo) {
        setRoundScheduleEmbargo({ roundNumber, ...target });
      } else {
        openEmbargoModal({
          title: t('publishing.embargoRoundSchedule', { roundNumber }),
          currentEmbargo: roundEmbargoDetail?.embargo,
          onSet: (embargo) => setRoundScheduleEmbargo({ roundNumber, embargo, ...target }),
        });
      }
    },
  });

  if (props?.pointerEvent && items.length) {
    tipster({ items, target: props.pointerEvent.target, config: { placement: BOTTOM } });
  }
}
