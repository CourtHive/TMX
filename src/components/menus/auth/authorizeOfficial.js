import { openModal } from 'components/modals/baseModal/baseModal';
import { copyClick } from 'services/dom/copyClick';
import { lang } from 'services/translator';
import { coms } from 'services/coms';

import { PUSH_KEY } from 'constants/comsConstants';

export function authorizeOfficial() {
  let uidate = new Date().getTime();
  let key_uuid = uidate.toString(36).slice(-6).toUpperCase();

  const displayKey = () => {
    let title = lang.tr('phrases.keycopied');
    let buttons = [{ label: lang.tr('tournaments.close'), intent: 'primary' }];
    let content = `<div>
        <h2 className="bp3-heading">${key_uuid}</h2>
      </div>`;
    openModal({ title, content, buttons });
  };

  coms.emitTmx({
    data: { action: PUSH_KEY, payload: undefined },
    ackCallback: displayKey
  });
  copyClick(key_uuid);
}
