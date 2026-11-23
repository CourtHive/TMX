/**
 * "Enter Time Warp" for the loaded tournament, with its clock started where it should be (CA 2026-11-22).
 *
 * After the tournament has ended the clock starts at the record's last change, no question asked: a past tournament's
 * snapshot is looked at from where it left off. During the tournament the operator chooses between the last change
 * and now. Before it starts, or with no change recorded, it starts now (`warpStartChoice`).
 */
import { venueCalendarDate, venueClock, venueToday } from 'functions/venueTimeFrame';
import { formatDateLabel } from 'components/schedule/scheduleDateSelectorLogic';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { warpStartChoice } from 'services/timeWarp/warpStartTime';
import { enterTimeWarp } from 'services/timeWarp/timeWarp';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

import { NONE } from 'constants/tmxConstants';

const when = (ms: number) => `${formatDateLabel(venueCalendarDate(ms))} ${venueClock(ms)}`;

export function enterTimeWarpAtChosenTime(): Promise<boolean> {
  const record = tournamentEngine.getTournament?.()?.tournamentRecord;
  const now = Date.now();
  const choice = warpStartChoice({ record, today: venueToday(), now });
  if (choice.kind === 'start') return enterTimeWarp({ startAt: choice.startAt });

  return new Promise((resolve) => {
    let settled = false;
    const settle = (startAt?: number) => {
      if (settled) return;
      settled = true;
      if (startAt === undefined) return resolve(false);
      void enterTimeWarp({ startAt }).then(resolve);
    };
    // settled before the modal closes: closing runs onClose, which would otherwise settle it as a cancel
    const choose = (startAt: number) => () => {
      settle(startAt);
      closeModal();
    };
    openModal({
      title: t('timeWarp.startTitle'),
      content: (elem: HTMLElement) => {
        const text = document.createElement('p');
        text.textContent = t('timeWarp.startQuestion');
        elem.appendChild(text);
      },
      onClose: () => settle(),
      buttons: [
        { label: t('common.cancel'), intent: NONE, close: true },
        {
          label: t('timeWarp.startAtLastChange', { when: when(choice.lastChange) }),
          intent: 'is-info',
          onClick: choose(choice.lastChange),
        },
        {
          label: t('timeWarp.startNow', { when: when(choice.now) }),
          intent: 'is-primary',
          onClick: choose(choice.now),
        },
      ],
    });
  });
}
