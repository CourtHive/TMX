/**
 * "This match is scheduled — keep the court?" prompt for manual BYE placement.
 *
 * A tournament director may schedule an entire event and then swap participants
 * around, placing byes temporarily or permanently. The engine therefore refuses to
 * decide on their behalf: `assignDrawPositionBye` returns `ERR_MATCHUP_HAS_SCHEDULING`
 * when an operator position-action targets a matchUp that already holds a court or a
 * time, and the caller must re-dispatch with an explicit `preserveScheduling`.
 *
 * Keeping the slot is the safe answer and is offered first. It is not a dead end:
 * a BYE that holds a court is drawn in the schedule grid and flagged
 * `CONFLICT_BYE_SCHEDULED` (WARNING), so the director can see it and release it later.
 */
import { openModal } from 'components/modals/baseModal/baseModal';
import { t } from 'i18n';

/**
 * Ask, then hand back the operator's choice. `onChoice` is not called if the
 * director cancels — the BYE is simply not assigned, which is a legitimate answer
 * to "I did not realise that match was already on a court".
 */
export function promptByeScheduling({ onChoice }: { onChoice: (preserveScheduling: boolean) => void }): void {
  openModal({
    title: t('schedule.byeScheduledTitle'),
    content: t('schedule.byeScheduledBody'),
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('schedule.byeKeepScheduling'), intent: 'is-info', onClick: () => onChoice(true), close: true },
      { label: t('schedule.byeRemoveScheduling'), intent: 'is-warning', onClick: () => onChoice(false), close: true },
    ],
  });
}
