import { copyClick } from 'services/dom/copyClick';
import { context } from 'services/context';
import { lang } from 'services/translator';
import { coms } from 'services/coms';

import { PUSH_KEY } from 'constants/comsConstants';

export function authorizeOfficial() {
  let uidate = new Date().getTime();
  let key_uuid = uidate.toString(36).slice(-6).toUpperCase();

  /*
  let payload = {
    key_uuid,
    content: {
      onetime: true,
      directive: 'delegationOfficial',
      content: {
        tuid: tournament.tuid,
        delegationOfficial: env.org && env.org.keys && env.org.keys.delegationOfficial,
        tournament: safeJSON.stringify(tournament)
      }
    },
    checkAuth: { admin: context.state.admin }
  };
  */

  const displayKey = () => {
    let title = lang.tr('phrases.keycopied');
    let buttons = [{ label: lang.tr('tournaments.close'), intent: 'primary' }];
    let content = `<div>
        <h2 className="bp3-heading">${key_uuid}</h2>
      </div>`;
    context.modal.open({ title, content, buttons });
  };

  coms.emitTmx({
    data: { action: PUSH_KEY, payload: undefined },
    ackCallback: displayKey
  });
  copyClick(key_uuid);
}
