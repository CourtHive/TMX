import { tournamentEngine } from 'tods-competition-factory';
import { copyClick } from 'services/dom/copyClick';
import { emitTmx } from 'services/messaging/socketIo';

import { PUSH_KEY, SEND_KEY } from '../../../constants/comsConstants';

export function authorizeAdmin() {
  let uidate = new Date().getTime();
  let key_uuid = uidate.toString(36).slice(-6).toUpperCase();

  const tournamentId = tournamentEngine.getTournamentInfo()?.tournamentInfo?.tournamentId;

  const payload = {
    key_uuid,
    content: {
      onetime: true,
      directive: 'authorize',
      content: {
        tuid: tournamentId,
        tournamentId,
        send_auth: true,
      },
    },
    checkAuth: { admin: true },
  };

  emitTmx({
    ackCallback: () => emitTmx({ data: { action: SEND_KEY, payload: { key: key_uuid.trim() } } }),
    data: { action: PUSH_KEY, payload },
  });

  copyClick(key_uuid);
}
