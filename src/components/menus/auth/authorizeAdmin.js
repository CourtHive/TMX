import { tournamentEngine } from 'tods-competition-factory';
import { copyClick } from 'services/dom/copyClick';
import { coms } from 'services/coms';

import { PUSH_KEY } from '../../../constants/comsConstants';

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
        send_auth: true
      }
    },
    checkAuth: { admin: true }
  };

  coms.emitTmx({
    ackCallback: () => coms.sendKey(key_uuid),
    data: { action: PUSH_KEY, payload }
  });

  copyClick(key_uuid);
}
