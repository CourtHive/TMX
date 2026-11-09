import { getCachedAllMatchUps } from 'pages/tournament/tabs/scheduleViews/schedule2DataCache';
import { readCheckInPromptMode } from 'pages/tournament/tabs/scheduleViews/gridViewStorage';
import { getMatchUpCheckInState, awaitingCheckIn } from 'services/checkIn/checkInState';
import { checkInInUse, shouldPromptOnCall } from 'services/checkIn/checkInPromptMode';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { openCheckInDialog } from './checkInDialog';
import { t } from 'i18n';

/** A changed schedule/status/line-up needs a new operator decision; presence changes alone do not. */
function callSnapshot(matchUp: any): string {
  return JSON.stringify([
    matchUp?.schedule,
    matchUp?.matchUpStatus,
    matchUp?.winningSide,
    getMatchUpCheckInState(matchUp).participants.map((participant) => participant.participantId),
  ]);
}

export function confirmCheckInCall({
  matchUpId,
  drawId,
  scheduledDate,
  onConfirmed,
  validate = () => true,
  drop = false,
}: {
  matchUpId: string;
  drawId: string;
  scheduledDate: string;
  onConfirmed: () => void;
  validate?: () => boolean;
  drop?: boolean;
}): void {
  const tournamentId = tournamentEngine.getTournamentId();
  const route = globalThis.location.hash;
  const read = () => tournamentEngine.findMatchUp({ matchUpId, drawId })?.matchUp;
  const matchUp = read();
  if (!matchUp) return;
  const awaiting = awaitingCheckIn(getMatchUpCheckInState(matchUp));
  if (
    !shouldPromptOnCall({
      mode: readCheckInPromptMode(),
      inUse: checkInInUse(getCachedAllMatchUps()?.matchUps, scheduledDate),
      awaitingCount: awaiting.length,
    })
  ) {
    if (validate()) onConfirmed();
    return;
  }
  const snapshot = callSnapshot(matchUp);
  const content = document.createElement('div');
  const message = document.createElement('p');
  message.textContent = t(drop ? 'checkIn.callOnDropBeforeCheckIn' : 'checkIn.callBeforeCheckIn', {
    count: awaiting.length,
  });
  const list = document.createElement('ul');
  for (const participant of awaiting) {
    const item = document.createElement('li');
    item.textContent = participant.participantName;
    list.appendChild(item);
  }
  content.append(message, list);
  openCheckInDialog({
    title: t('checkIn.callTitle'),
    content,
    onConfirm: () => {
      if (
        globalThis.location.hash !== route ||
        tournamentEngine.getTournamentId() !== tournamentId ||
        snapshot !== callSnapshot(read()) ||
        !validate()
      ) {
        tmxToast({ message: t('checkIn.callChanged'), intent: 'is-warning' });
        return;
      }
      onConfirmed();
    },
  });
}
